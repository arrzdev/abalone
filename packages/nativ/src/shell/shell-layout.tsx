import { HeadContent, Scripts } from "@tanstack/react-router"
import type { ComponentType, ReactNode } from "react"
import { useCallback, useState } from "react"
import { OrientationGuard } from "#nativ/components/orientation-guard"
import type { NativPatches } from "#nativ/config/app-config"
import type {
  OrientationGuardProps,
  PwaServiceWorkerRuntimeConfig,
  SplashScreenProps,
} from "#nativ/config/types"
import { useCaretRepaint } from "#nativ/hooks/use-caret-repaint"
import { useFreezeViewport } from "#nativ/hooks/use-freeze-viewport"
import { useGlobalFpsSentinel } from "#nativ/hooks/use-global-fps-sentinel"
import { useRegisterPwaServiceWorker } from "#nativ/hooks/use-register-pwa-service-worker"
import { useSuppressTextMagnifier } from "#nativ/hooks/use-suppress-text-magnifier"
import { useSyncTheme } from "#nativ/hooks/use-sync-theme"
import { useTheme } from "#nativ/hooks/use-theme"
import { cn } from "#nativ/utils/cn"

const DOCUMENT_SHELL_CLASS = "m-0 h-dvh touch-none overscroll-none"

const APP_SHELL_CLASS =
  "box-border flex min-h-0 min-w-0 w-full flex-col overflow-hidden h-dvh app:h-screen"

const APP_SCREEN_FRAME_CLASS =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden hardware-boosted"

export type AppShellProps = {
  children: ReactNode
  className?: string
  frameClassName?: string
}

export function AppShell({
  children,
  className,
  frameClassName,
}: AppShellProps) {
  return (
    <div data-app-shell className={cn(APP_SHELL_CLASS, className)}>
      <div className={cn(APP_SCREEN_FRAME_CLASS, frameClassName)}>
        {children}
      </div>
    </div>
  )
}

export type RootDocumentProps = {
  children: ReactNode
}

type RootDocumentOptions = {
  lang?: string
  htmlClassName?: string
  htmlAttrs?: Record<string, string>
  /** Inline critical CSS rendered first in `<head>` (brand background per theme). */
  criticalCss?: string
  /** Blocking theme init script rendered before `<HeadContent/>` (runs pre-paint). */
  headInitScript?: string
}

function DefaultRootDocument({
  children,
  lang = "en",
  htmlClassName,
  htmlAttrs,
  criticalCss,
  headInitScript,
}: RootDocumentProps & RootDocumentOptions) {
  return (
    <html
      lang={lang}
      className={cn(DOCUMENT_SHELL_CLASS, htmlClassName)}
      suppressHydrationWarning
      {...htmlAttrs}
    >
      <head>
        {/* theme init first so the html class/background resolve before paint */}
        {headInitScript && (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted inline shell init script
          <script dangerouslySetInnerHTML={{ __html: headInitScript }} />
        )}
        {criticalCss && (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted inline shell critical CSS
          <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
        )}
        <HeadContent />
      </head>
      <body className={DOCUMENT_SHELL_CLASS} suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

export function createRootDocument(
  options: RootDocumentOptions,
): ComponentType<RootDocumentProps> {
  return function RootDocument({ children }) {
    return (
      <DefaultRootDocument {...options}>{children}</DefaultRootDocument>
    )
  }
}

type RoutingShellProps = {
  themeColorLight: string
  themeColorDark: string
  splashScreenComponent?: ComponentType<SplashScreenProps>
  /** Manifest path; its `orientation` field drives the touch-device rotate guard. */
  manifestPath?: string
  orientationGuardComponent?: ComponentType<OrientationGuardProps>
  serviceWorker?: PwaServiceWorkerRuntimeConfig
  shellClassName?: string
  /** Native-feel WebKit fixes; each defaults to `true`. See {@link NativPatches}. */
  patches?: NativPatches
  children: ReactNode
}

export function RoutingShell({
  themeColorLight,
  themeColorDark,
  splashScreenComponent,
  manifestPath = "/manifest.json",
  orientationGuardComponent,
  serviceWorker,
  shellClassName,
  patches,
  children,
}: RoutingShellProps) {
  //resolve each native-feel fix — all default on, opt out per fix via config.
  const caretRepaint = patches?.caretRepaint ?? true
  const textMagnifier = patches?.textMagnifier ?? true
  const viewportFreeze = patches?.viewportFreeze ?? true
  const gpuBoost = patches?.gpuBoost ?? true

  useTheme()
  useSyncTheme({ themeColorLight, themeColorDark })
  //watch the frame rate and GPU-promote animating layers when frames drop
  useGlobalFpsSentinel({ enabled: gpuBoost })
  //app-wide iOS caret-repaint patch — mutes a focused field's caret while it moves and
  //force-repaints it on settle, so a translated input never leaves a detached ghost caret
  useCaretRepaint({ enabled: caretRepaint })
  useRegisterPwaServiceWorker(serviceWorker)
  //kill the iOS WebKit double-tap text-magnifier loupe app-wide (WebKit bug
  //231161 — not fixable in CSS; see the hook for the "safe to remove?" check)
  useSuppressTextMagnifier({ enabled: textMagnifier })
  //hold the drawer's viewport lock (scroll pin + virtualKeyboard overlay) app-wide
  //so the keyboard / url bar can't shift the layout. refcounted, so an opening
  //drawer just coexists ("double lock") and behaves exactly as before.
  useFreezeViewport(viewportFreeze)

  const [splashVisible, setSplashVisible] = useState(
    () => splashScreenComponent !== undefined,
  )
  const hideSplash = useCallback(() => setSplashVisible(false), [])
  const SplashScreenComponent = splashScreenComponent

  return (
    <>
      {splashVisible && SplashScreenComponent && (
        <SplashScreenComponent hide={hideSplash} />
      )}
      <AppShell className={shellClassName}>{children}</AppShell>
      <OrientationGuard
        manifestPath={manifestPath}
        component={orientationGuardComponent}
      />
    </>
  )
}
