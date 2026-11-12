// chaos-overlay.dll — Elden Ring (DX12) 화면 안에 지금 걸린 효과 목록을 직접 그린다.
//
// Structure:
//  - Cheat Engine bridge injects this DLL (overlaydll command). No mod loader needed.
//  - We do NOT patch DXGI/D3D12 vtables or function prologues. Steam overlay and OBS game capture
//    both hook IDXGISwapChain::Present that way; a third hooker there made them call each other
//    forever (stack overflow in gameoverlayrenderer64 <-> graphics_hook64, 2026-11-12).
//    Instead we patch the one place in eldenring.exe that calls Present
//    (`mov rax,[rcx]; call [rax+40h]` → `call stub`). We run before Steam/OBS and then call
//    Present through the vtable exactly like the game did, so their hook chain is untouched.
//  - The game's direct command queue is found by scanning the swapchain object for a pointer
//    whose vtable matches a D3D12 command queue (no ExecuteCommandLists hook needed).
//  - Each frame with text: wrap the current back buffer (D3D11On12), alpha-blend a BGRA text
//    texture (Direct2D + DirectWrite, redrawn only when the text changes), release, flush.
//    Nothing is held between frames, so the game's own ResizeBuffers is never blocked.
//  - Text comes from %TEMP%\chzzk-souls-chaos\screen.txt (UTF-8, written by the adapter every second).
//    A line starting with '#' is the footer (gold). A file older than 3 s = adapter gone → draw nothing.
//
// Log: %TEMP%\chzzk-souls-chaos\overlay-dll.log
/**
 * ── 알려진 한계 ──────────────────────────────
 *  · 게임 코드의 Present 호출 위치를 바이트 패턴으로 찾는다. 엘든링이 업데이트돼 패턴이 바뀌면
 *    아무것도 그리지 않고 로그에 "present call site not found" 를 남긴다 (게임은 정상).
 *  · HDR(ST2084) 출력이면 글자 색이 SDR 기준이라 어둡거나 바랠 수 있다 (1.17.2 기본은 SDR 10비트 R10G10B10A2).
 *  · 그리기 오류가 연달아 나면 스스로 꺼진다(게임은 계속 돈다). 다시 켜려면 게임 재시작.
 *  · ReShade·DLSS 모드처럼 dxgi.dll 을 바꿔치기하는 모드와 같이 쓰면 확인 안 됨.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <d3d11on12.h>
#include <d3d12.h>
#include <d3dcompiler.h>
#include <d2d1_1.h>
#include <dwrite.h>
#include <dxgi1_4.h>
#include <tlhelp32.h>
#include <wrl/client.h>

#include <algorithm>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

#pragma comment(lib, "d2d1.lib")
#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "d3d12.lib")
#pragma comment(lib, "d3dcompiler.lib")
#pragma comment(lib, "dwrite.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "user32.lib")

using Microsoft::WRL::ComPtr;

// ── log ──
static std::wstring g_dir;
static std::mutex g_logMx;
static void logf(const char* fmt, ...) {
  std::lock_guard<std::mutex> lk(g_logMx);
  FILE* f = _wfopen((g_dir + L"\\overlay-dll.log").c_str(), L"a");
  if (!f) return;
  SYSTEMTIME t; GetLocalTime(&t);
  fprintf(f, "%02d:%02d:%02d ", t.wHour, t.wMinute, t.wSecond);
  va_list ap; va_start(ap, fmt); vfprintf(f, fmt, ap); va_end(ap);
  fputc('\n', f);
  fclose(f);
}

// ── text from adapter ──
struct Lines { std::vector<std::wstring> items; std::wstring footer; };
static std::mutex g_textMx;
static Lines g_text;

static DWORD WINAPI ReaderThread(LPVOID) {
  const std::wstring path = g_dir + L"\\screen.txt";
  for (;;) {
    Lines next;
    WIN32_FILE_ATTRIBUTE_DATA a{};
    if (GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &a)) {
      FILETIME now; GetSystemTimeAsFileTime(&now);
      ULARGE_INTEGER n{}, w{};
      n.LowPart = now.dwLowDateTime; n.HighPart = now.dwHighDateTime;
      w.LowPart = a.ftLastWriteTime.dwLowDateTime; w.HighPart = a.ftLastWriteTime.dwHighDateTime;
      const bool fresh = n.QuadPart < w.QuadPart + 3ull * 10000000ull;
      HANDLE h = fresh ? CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, 0, nullptr) : INVALID_HANDLE_VALUE;
      if (h != INVALID_HANDLE_VALUE) {
        char buf[8192]; DWORD got = 0;
        ReadFile(h, buf, sizeof(buf) - 1, &got, nullptr);
        CloseHandle(h);
        int wn = MultiByteToWideChar(CP_UTF8, 0, buf, (int)got, nullptr, 0);
        std::wstring all(wn, L'\0');
        MultiByteToWideChar(CP_UTF8, 0, buf, (int)got, all.data(), wn);
        size_t s = 0;
        while (s < all.size()) {
          size_t e = all.find(L'\n', s);
          if (e == std::wstring::npos) e = all.size();
          std::wstring line = all.substr(s, e - s);
          if (!line.empty() && line.back() == L'\r') line.pop_back();
          if (!line.empty() && line[0] == 0xFEFF) line.erase(0, 1);
          if (!line.empty()) {
            if (line[0] == L'#') next.footer = line.substr(1);
            else next.items.push_back(line);
          }
          s = e + 1;
        }
      }
    }
    { std::lock_guard<std::mutex> lk(g_textMx); g_text = std::move(next); }
    Sleep(250);
  }
}

// ── safe memory read (game memory we scan may not be readable) ──
static bool SafeRead(const void* p, void* out, size_t n) {
  __try { memcpy(out, p, n); return true; }
  __except (EXCEPTION_EXECUTE_HANDLER) { return false; }
}

// ── find the game's direct queue inside the swapchain object ──
static void* g_queueVtbl;  // vtable of a D3D12 command queue (from a dummy queue)

static ID3D12CommandQueue* AsQueue(void* p, ID3D12Device* dev) {
  void* vt = nullptr;
  if (!p || !SafeRead(p, &vt, sizeof(vt)) || vt != g_queueVtbl) return nullptr;
  auto* q = static_cast<ID3D12CommandQueue*>(p);
  if (q->GetDesc().Type != D3D12_COMMAND_LIST_TYPE_DIRECT) return nullptr;
  ComPtr<ID3D12Device> qd;
  if (FAILED(q->GetDevice(IID_PPV_ARGS(&qd))) || qd.Get() != dev) return nullptr;
  return q;
}

static ID3D12CommandQueue* FindQueue(IDXGISwapChain* sc, ID3D12Device* dev) {
  const auto* base = reinterpret_cast<const uint8_t*>(sc);
  for (size_t off = 0; off < 0x1000; off += 8) {
    void* p = nullptr;
    if (!SafeRead(base + off, &p, sizeof(p))) break;
    if (auto* q = AsQueue(p, dev)) { logf("queue found at swapchain+0x%zX", off); return q; }
  }
  for (size_t off = 0; off < 0x400; off += 8) {  // one level deeper
    void* p = nullptr;
    if (!SafeRead(base + off, &p, sizeof(p))) break;
    if (!p || (uintptr_t)p < 0x10000) continue;
    const auto* b2 = static_cast<const uint8_t*>(p);
    for (size_t o2 = 0; o2 < 0x400; o2 += 8) {
      void* p2 = nullptr;
      if (!SafeRead(b2 + o2, &p2, sizeof(p2))) break;
      if (auto* q = AsQueue(p2, dev)) { logf("queue found at [swapchain+0x%zX]+0x%zX", off, o2); return q; }
    }
  }
  return nullptr;
}

// ── renderer state (render thread only) ──
// 엘든링 스왑체인은 10비트(R10G10B10A2)라 Direct2D 가 직접 못 그린다.
// → 글자는 8비트 BGRA 텍스처에 D2D 로 그리고(글자가 바뀔 때만), 매 프레임 D3D11 셰이더로 백버퍼에 알파 합성한다.
static const char* kShader = R"(
struct V { float4 pos : SV_Position; float2 uv : TEXCOORD0; };
V vs(uint id : SV_VertexID) { V o; o.uv = float2((id << 1) & 2, id & 2); o.pos = float4(o.uv * float2(2, -2) + float2(-1, 1), 0, 1); return o; }
Texture2D t : register(t0); SamplerState s : register(s0);
float4 ps(V i) : SV_Target { return t.Sample(s, i.uv); }
)";

static IDXGISwapChain* g_sc;  // swapchain we built for (not owned)
static ComPtr<ID3D11Device> g_d11;
static ComPtr<ID3D11On12Device> g_11on12;
static ComPtr<ID3D11DeviceContext> g_ctx;
static ComPtr<ID3D11VertexShader> g_vs;
static ComPtr<ID3D11PixelShader> g_ps;
static ComPtr<ID3D11BlendState> g_blend;
static ComPtr<ID3D11SamplerState> g_samp;
static ComPtr<ID3D11RasterizerState> g_rast;
static ComPtr<ID3D11Texture2D> g_textTex;
static ComPtr<ID3D11ShaderResourceView> g_textSrv;
static ComPtr<ID2D1DeviceContext> g_d2d;
static ComPtr<ID2D1Bitmap1> g_textBmp;
static ComPtr<IDWriteFactory> g_dw;
static ComPtr<IDWriteTextFormat> g_fmt, g_fmtSmall;
static ComPtr<ID2D1SolidColorBrush> g_white, g_shadow, g_gold;
static UINT g_w, g_h;
static Lines g_drawn;      // text currently in g_textTex
static bool g_textValid;
static bool g_dead;        // gave up for good
static int g_errors;

static void Fail(const char* what, HRESULT hr) {
  logf("%s failed hr=0x%08X", what, (unsigned)hr);
  if (++g_errors >= 10) { g_dead = true; logf("too many errors, overlay disabled until game restart"); }
}

static void ReleaseTextTarget() {
  if (g_d2d) g_d2d->SetTarget(nullptr);
  g_textBmp.Reset(); g_textSrv.Reset(); g_textTex.Reset();
  g_textValid = false;
}

static bool CreateTextTarget(UINT w, UINT h) {
  ReleaseTextTarget();
  HRESULT hr;
  D3D11_TEXTURE2D_DESC td{};
  td.Width = w; td.Height = h; td.MipLevels = 1; td.ArraySize = 1;
  td.Format = DXGI_FORMAT_B8G8R8A8_UNORM; td.SampleDesc.Count = 1;
  td.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;
  if (FAILED(hr = g_d11->CreateTexture2D(&td, nullptr, &g_textTex))) { Fail("CreateTexture2D", hr); return false; }
  g_d11->CreateShaderResourceView(g_textTex.Get(), nullptr, &g_textSrv);
  ComPtr<IDXGISurface> surf; g_textTex.As(&surf);
  D2D1_BITMAP_PROPERTIES1 bp = D2D1::BitmapProperties1(D2D1_BITMAP_OPTIONS_TARGET | D2D1_BITMAP_OPTIONS_CANNOT_DRAW,
                                                       D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED), 96.f, 96.f);
  if (FAILED(hr = g_d2d->CreateBitmapFromDxgiSurface(surf.Get(), &bp, &g_textBmp))) { Fail("CreateBitmapFromDxgiSurface", hr); ReleaseTextTarget(); return false; }
  // 글자 크기: 720p 에서 20px (창 오버레이와 같은 비율)
  const float size = h * 20.f / 720.f;
  g_fmt.Reset(); g_fmtSmall.Reset();
  g_dw->CreateTextFormat(L"Malgun Gothic", nullptr, DWRITE_FONT_WEIGHT_BOLD, DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL, size, L"ko-kr", &g_fmt);
  g_dw->CreateTextFormat(L"Malgun Gothic", nullptr, DWRITE_FONT_WEIGHT_BOLD, DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL, size * 0.8f, L"ko-kr", &g_fmtSmall);
  if (!g_fmt || !g_fmtSmall) { Fail("CreateTextFormat", E_FAIL); ReleaseTextTarget(); return false; }
  g_fmt->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
  g_fmtSmall->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
  g_w = w; g_h = h;
  logf("text target %ux%u", w, h);
  return true;
}

static bool Init(IDXGISwapChain* sc) {
  ComPtr<ID3D12Device> dev;
  HRESULT hr = sc->GetDevice(IID_PPV_ARGS(&dev));
  if (FAILED(hr)) { logf("swapchain is not D3D12 (hr=0x%08X), overlay off", (unsigned)hr); g_dead = true; return false; }
  ID3D12CommandQueue* q = FindQueue(sc, dev.Get());
  if (!q) { logf("game command queue not found in swapchain, overlay off"); g_dead = true; return false; }

  IUnknown* queues[] = { q };
  hr = D3D11On12CreateDevice(dev.Get(), D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0, queues, 1, 0, &g_d11, &g_ctx, nullptr);
  if (FAILED(hr)) { Fail("D3D11On12CreateDevice", hr); g_dead = true; return false; }
  g_d11.As(&g_11on12);

  ComPtr<ID3DBlob> vsb, psb, err;
  if (FAILED(hr = D3DCompile(kShader, strlen(kShader), nullptr, nullptr, nullptr, "vs", "vs_5_0", 0, 0, &vsb, &err)) ||
      FAILED(hr = D3DCompile(kShader, strlen(kShader), nullptr, nullptr, nullptr, "ps", "ps_5_0", 0, 0, &psb, &err))) {
    logf("shader compile: %s", err ? (const char*)err->GetBufferPointer() : "?");
    g_dead = true; return false;
  }
  g_d11->CreateVertexShader(vsb->GetBufferPointer(), vsb->GetBufferSize(), nullptr, &g_vs);
  g_d11->CreatePixelShader(psb->GetBufferPointer(), psb->GetBufferSize(), nullptr, &g_ps);
  D3D11_BLEND_DESC bd{};
  auto& rt = bd.RenderTarget[0];
  rt.BlendEnable = TRUE;  // premultiplied alpha
  rt.SrcBlend = D3D11_BLEND_ONE; rt.DestBlend = D3D11_BLEND_INV_SRC_ALPHA; rt.BlendOp = D3D11_BLEND_OP_ADD;
  rt.SrcBlendAlpha = D3D11_BLEND_ZERO; rt.DestBlendAlpha = D3D11_BLEND_ONE; rt.BlendOpAlpha = D3D11_BLEND_OP_ADD;
  rt.RenderTargetWriteMask = D3D11_COLOR_WRITE_ENABLE_ALL;
  g_d11->CreateBlendState(&bd, &g_blend);
  D3D11_SAMPLER_DESC sd{};
  sd.Filter = D3D11_FILTER_MIN_MAG_MIP_POINT;
  sd.AddressU = sd.AddressV = sd.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
  sd.MaxLOD = D3D11_FLOAT32_MAX;
  g_d11->CreateSamplerState(&sd, &g_samp);
  D3D11_RASTERIZER_DESC rd{}; rd.FillMode = D3D11_FILL_SOLID; rd.CullMode = D3D11_CULL_NONE; rd.DepthClipEnable = TRUE;
  g_d11->CreateRasterizerState(&rd, &g_rast);
  if (!g_vs || !g_ps || !g_blend || !g_samp || !g_rast) { Fail("D3D11 state objects", E_FAIL); g_dead = true; return false; }

  ComPtr<ID2D1Factory1> fac;
  D2D1_FACTORY_OPTIONS fo{};
  if (FAILED(hr = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, __uuidof(ID2D1Factory1), &fo, &fac))) { Fail("D2D1CreateFactory", hr); g_dead = true; return false; }
  ComPtr<IDXGIDevice> dxgiDev; g_d11.As(&dxgiDev);
  ComPtr<ID2D1Device> d2dDev;
  if (FAILED(hr = fac->CreateDevice(dxgiDev.Get(), &d2dDev))) { Fail("ID2D1Factory1::CreateDevice", hr); g_dead = true; return false; }
  if (FAILED(hr = d2dDev->CreateDeviceContext(D2D1_DEVICE_CONTEXT_OPTIONS_NONE, &g_d2d))) { Fail("CreateDeviceContext", hr); g_dead = true; return false; }
  if (FAILED(hr = DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED, __uuidof(IDWriteFactory), reinterpret_cast<IUnknown**>(g_dw.GetAddressOf())))) { Fail("DWriteCreateFactory", hr); g_dead = true; return false; }
  g_d2d->CreateSolidColorBrush(D2D1::ColorF(1.f, 1.f, 1.f, 1.f), &g_white);
  g_d2d->CreateSolidColorBrush(D2D1::ColorF(0.f, 0.f, 0.f, 0.85f), &g_shadow);
  g_d2d->CreateSolidColorBrush(D2D1::ColorF(1.f, 0.82f, 0.35f, 1.f), &g_gold);
  g_d2d->SetTextAntialiasMode(D2D1_TEXT_ANTIALIAS_MODE_GRAYSCALE);
  g_sc = sc;
  logf("renderer ready");
  return true;
}

static bool SameText(const Lines& a, const Lines& b) { return a.items == b.items && a.footer == b.footer; }

// 글자가 바뀌었을 때만 텍스처를 다시 그린다
static bool RenderText(const Lines& t) {
  g_d2d->SetTarget(g_textBmp.Get());
  g_d2d->BeginDraw();
  g_d2d->Clear(D2D1::ColorF(0, 0, 0, 0));
  const float size = g_h * 20.f / 720.f;
  const float x = size * 0.6f, lineH = size * 1.45f, sh = (std::max)(1.f, size / 10.f);
  float y = g_h * 0.15f;
  auto line = [&](const std::wstring& s, IDWriteTextFormat* fmt, ID2D1Brush* brush) {
    D2D1_RECT_F rc = D2D1::RectF(x + sh, y + sh, (float)g_w, y + lineH * 2);
    g_d2d->DrawText(s.c_str(), (UINT32)s.size(), fmt, rc, g_shadow.Get());
    rc = D2D1::RectF(x, y, (float)g_w, y + lineH * 2);
    g_d2d->DrawText(s.c_str(), (UINT32)s.size(), fmt, rc, brush);
    y += lineH;
  };
  for (auto& s : t.items) line(s, g_fmt.Get(), g_white.Get());
  if (!t.footer.empty()) line(t.footer, g_fmtSmall.Get(), g_gold.Get());
  HRESULT hr = g_d2d->EndDraw();
  g_d2d->SetTarget(nullptr);
  if (FAILED(hr)) { Fail("EndDraw", hr); return false; }
  g_drawn = t;
  g_textValid = true;
  return true;
}

static void Draw(IDXGISwapChain* sc) {
  if (g_dead) return;
  if (!g_sc) { if (!Init(sc)) return; }
  if (sc != g_sc) return;  // 게임이 만든 다른 스왑체인은 무시

  Lines t;
  { std::lock_guard<std::mutex> lk(g_textMx); t = g_text; }
  if (t.items.empty() && t.footer.empty()) return;  // 그릴 게 없으면 아무 일도 안 함 (백버퍼도 안 건드림)

  DXGI_SWAP_CHAIN_DESC d{};
  HRESULT hr = sc->GetDesc(&d);
  if (FAILED(hr)) { Fail("GetDesc", hr); return; }
  if (!g_textTex || d.BufferDesc.Width != g_w || d.BufferDesc.Height != g_h) {
    if (!CreateTextTarget(d.BufferDesc.Width, d.BufferDesc.Height)) return;
  }
  if (!g_textValid || !SameText(t, g_drawn)) { if (!RenderText(t)) { ReleaseTextTarget(); return; } }

  ComPtr<IDXGISwapChain3> sc3;
  if (FAILED(sc->QueryInterface(IID_PPV_ARGS(&sc3)))) { Fail("IDXGISwapChain3", E_NOINTERFACE); return; }
  ComPtr<ID3D12Resource> res;
  if (FAILED(hr = sc->GetBuffer(sc3->GetCurrentBackBufferIndex(), IID_PPV_ARGS(&res)))) { Fail("GetBuffer", hr); return; }
  // 매 프레임 감싸고 바로 놓는다: 프레임 사이에 백버퍼 참조를 들고 있으면 게임의 ResizeBuffers 가 실패한다
  ComPtr<ID3D11Resource> wrapped;
  D3D11_RESOURCE_FLAGS fl{}; fl.BindFlags = D3D11_BIND_RENDER_TARGET;
  hr = g_11on12->CreateWrappedResource(res.Get(), &fl, D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_PRESENT, IID_PPV_ARGS(&wrapped));
  if (FAILED(hr)) { Fail("CreateWrappedResource", hr); return; }
  ComPtr<ID3D11RenderTargetView> rtv;
  if (FAILED(hr = g_d11->CreateRenderTargetView(wrapped.Get(), nullptr, &rtv))) { Fail("CreateRenderTargetView", hr); return; }

  ID3D11Resource* r = wrapped.Get();
  g_11on12->AcquireWrappedResources(&r, 1);
  D3D11_VIEWPORT vp{ 0, 0, (float)g_w, (float)g_h, 0, 1 };
  ID3D11RenderTargetView* rtvs = rtv.Get();
  ID3D11ShaderResourceView* srv = g_textSrv.Get();
  ID3D11SamplerState* samp = g_samp.Get();
  g_ctx->OMSetRenderTargets(1, &rtvs, nullptr);
  g_ctx->OMSetBlendState(g_blend.Get(), nullptr, 0xffffffff);
  g_ctx->RSSetViewports(1, &vp);
  g_ctx->RSSetState(g_rast.Get());
  g_ctx->IASetInputLayout(nullptr);
  g_ctx->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
  g_ctx->VSSetShader(g_vs.Get(), nullptr, 0);
  g_ctx->PSSetShader(g_ps.Get(), nullptr, 0);
  g_ctx->PSSetShaderResources(0, 1, &srv);
  g_ctx->PSSetSamplers(0, 1, &samp);
  g_ctx->Draw(3, 0);
  g_ctx->ClearState();
  g_11on12->ReleaseWrappedResources(&r, 1);
  rtv.Reset();
  wrapped.Reset();
  g_ctx->Flush();
}

// ── the game's Present call, rerouted here ──
// 원래 코드: mov rax,[rcx]; call [rax+40h]  (rcx=swapchain, edx=sync, r8d=flags)
static HRESULT __stdcall GamePresent(IDXGISwapChain* sc, UINT sync, UINT flags) {
  if (!(flags & DXGI_PRESENT_TEST)) Draw(sc);
  return sc->Present(sync, flags);  // 게임과 똑같이 vtable 로 → Steam/OBS 훅 체인 그대로
}

// mov rcx,[rbx]; xor r8d,r8d; mov edx,r12d; mov rax,[rcx]; call [rax+40h]
static const uint8_t kSite[] = { 0x48, 0x8B, 0x0B, 0x45, 0x33, 0xC0, 0x41, 0x8B, 0xD4, 0x48, 0x8B, 0x01, 0xFF, 0x50, 0x40 };
static const size_t kPatchOff = 9;  // "mov rax,[rcx]; call [rax+40h]" = 6 bytes → call rel32 + nop

static uint8_t* FindSite() {
  auto* mod = reinterpret_cast<uint8_t*>(GetModuleHandleW(nullptr));
  auto* dos = reinterpret_cast<IMAGE_DOS_HEADER*>(mod);
  auto* nt = reinterpret_cast<IMAGE_NT_HEADERS*>(mod + dos->e_lfanew);
  auto* sec = IMAGE_FIRST_SECTION(nt);
  uint8_t* found = nullptr;
  int count = 0;
  for (int i = 0; i < nt->FileHeader.NumberOfSections; i++, sec++) {
    if (!(sec->Characteristics & IMAGE_SCN_MEM_EXECUTE)) continue;
    uint8_t* p = mod + sec->VirtualAddress;
    const size_t n = sec->Misc.VirtualSize;
    for (size_t j = 0; j + sizeof(kSite) <= n; j++) {
      uint8_t b;
      if (!SafeRead(p + j, &b, 1)) { j += 0xFFF; continue; }
      if (b != kSite[0]) continue;
      uint8_t buf[sizeof(kSite)];
      if (SafeRead(p + j, buf, sizeof(buf)) && memcmp(buf, kSite, sizeof(kSite)) == 0) { found = p + j; count++; }
    }
  }
  logf("present call site matches: %d", count);
  return count == 1 ? found : nullptr;
}

static void* AllocNear(void* target, size_t size) {
  SYSTEM_INFO si; GetSystemInfo(&si);
  const uintptr_t gran = si.dwAllocationGranularity;
  const uintptr_t t = reinterpret_cast<uintptr_t>(target);
  for (uintptr_t d = gran; d < 0x70000000; d += gran) {
    for (int sign = -1; sign <= 1; sign += 2) {
      uintptr_t a = sign < 0 ? (t > d ? ((t - d) & ~(gran - 1)) : 0) : ((t + d) & ~(gran - 1));
      if (!a) continue;
      if (void* p = VirtualAlloc(reinterpret_cast<void*>(a), size, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE)) return p;
    }
  }
  return nullptr;
}

// 다른 스레드가 바꾸는 중인 6바이트를 실행하지 않도록, 패치하는 동안 이 프로세스의 다른 스레드를 멈춘다
static bool PatchWithThreadsSuspended(uint8_t* at, const uint8_t* bytes, size_t n) {
  std::vector<HANDLE> stopped;
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);
  THREADENTRY32 te{ sizeof(te) };
  const DWORD pid = GetCurrentProcessId(), me = GetCurrentThreadId();
  if (snap != INVALID_HANDLE_VALUE && Thread32First(snap, &te)) {
    do {
      if (te.th32OwnerProcessID != pid || te.th32ThreadID == me) continue;
      HANDLE h = OpenThread(THREAD_SUSPEND_RESUME | THREAD_GET_CONTEXT, FALSE, te.th32ThreadID);
      if (h && SuspendThread(h) != (DWORD)-1) stopped.push_back(h);
      else if (h) CloseHandle(h);
    } while (Thread32Next(snap, &te));
  }
  if (snap != INVALID_HANDLE_VALUE) CloseHandle(snap);
  bool busy = false;
  for (HANDLE h : stopped) {
    CONTEXT c{}; c.ContextFlags = CONTEXT_CONTROL;
    if (GetThreadContext(h, &c) && c.Rip > (DWORD64)at && c.Rip < (DWORD64)(at + n)) busy = true;
  }
  bool ok = false;
  if (!busy) {
    DWORD old;
    if (VirtualProtect(at, n, PAGE_EXECUTE_READWRITE, &old)) {
      memcpy(at, bytes, n);
      VirtualProtect(at, n, old, &old);
      FlushInstructionCache(GetCurrentProcess(), at, n);
      ok = true;
    }
  }
  for (HANDLE h : stopped) { ResumeThread(h); CloseHandle(h); }
  return ok;
}

static bool InstallPresentHook() {
  uint8_t* site = FindSite();
  if (!site) { logf("present call site not found (game updated?), overlay off"); return false; }
  uint8_t* at = site + kPatchOff;
  auto* stub = static_cast<uint8_t*>(AllocNear(at, 64));
  if (!stub) { logf("no memory near game code, overlay off"); return false; }
  // stub: mov rax, GamePresent; jmp rax  (게임의 call 이 넣은 복귀 주소로 GamePresent 가 바로 돌아간다)
  stub[0] = 0x48; stub[1] = 0xB8;
  void* fn = reinterpret_cast<void*>(&GamePresent);
  memcpy(stub + 2, &fn, 8);
  stub[10] = 0xFF; stub[11] = 0xE0;
  FlushInstructionCache(GetCurrentProcess(), stub, 12);
  const int64_t rel = reinterpret_cast<int64_t>(stub) - reinterpret_cast<int64_t>(at + 5);
  if (rel < INT32_MIN || rel > INT32_MAX) { logf("stub too far"); return false; }
  uint8_t patch[6] = { 0xE8, 0, 0, 0, 0, 0x90 };
  const int32_t r32 = static_cast<int32_t>(rel);
  memcpy(patch + 1, &r32, 4);
  for (int tries = 0; tries < 50; tries++) {
    if (PatchWithThreadsSuspended(at, patch, sizeof(patch))) {
      logf("present call patched at eldenring+0x%llX", (unsigned long long)(at - reinterpret_cast<uint8_t*>(GetModuleHandleW(nullptr))));
      return true;
    }
    Sleep(5);
  }
  logf("could not patch present call (thread busy), overlay off");
  return false;
}

static bool LearnQueueVtable() {
  ComPtr<ID3D12Device> dev;
  HRESULT hr = D3D12CreateDevice(nullptr, D3D_FEATURE_LEVEL_11_0, IID_PPV_ARGS(&dev));
  if (FAILED(hr)) { logf("D3D12CreateDevice hr=0x%08X", (unsigned)hr); return false; }
  D3D12_COMMAND_QUEUE_DESC qd{}; qd.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;
  ComPtr<ID3D12CommandQueue> q;
  if (FAILED(hr = dev->CreateCommandQueue(&qd, IID_PPV_ARGS(&q)))) { logf("CreateCommandQueue hr=0x%08X", (unsigned)hr); return false; }
  g_queueVtbl = *reinterpret_cast<void**>(q.Get());
  return true;
}

static DWORD WINAPI MainThread(LPVOID) {
  logf("loaded into pid %lu", GetCurrentProcessId());
  CreateThread(nullptr, 0, ReaderThread, nullptr, 0, nullptr);
  if (!LearnQueueVtable()) { logf("overlay off"); return 0; }
  logf(InstallPresentHook() ? "hook installed" : "hook install FAILED");
  return 0;
}

BOOL APIENTRY DllMain(HMODULE mod, DWORD reason, LPVOID) {
  if (reason == DLL_PROCESS_ATTACH) {
    DisableThreadLibraryCalls(mod);
    wchar_t tmp[MAX_PATH];
    GetTempPathW(MAX_PATH, tmp);
    g_dir = std::wstring(tmp) + L"chzzk-souls-chaos";
    CreateDirectoryW(g_dir.c_str(), nullptr);
    CreateThread(nullptr, 0, MainThread, nullptr, 0, nullptr);
  }
  return TRUE;
}
