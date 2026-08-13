import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { TapButton } from '../components/ui/TapButton.jsx';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';
import { GroupIcon, WifiIcon } from '../components/Icons.jsx';

/**
 * Entry screen: pick online or offline, nothing more.
 *
 * There is no game-code field here on purpose. Online play has to ask for a
 * username first, and then split into creating a game (the server hands back the
 * code) and joining one (the player types it) — so the code belongs to whichever
 * of those two screens turns out to need it, not to the front door.
 */
export function HomePage({ onPlayOffline, onOpenRules }) {
  const { t } = useTranslation();
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  return (
    <div className="relative h-full overflow-hidden bg-elevated">
      {/* Ambient background wash. Outside the scroller, so it stays put. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -right-32 -bottom-40 h-96 w-96 rounded-full bg-board/10 blur-3xl" />
      </div>

      <div className="absolute top-5 right-5 z-10">
        <LanguageSwitcher variant="solid" />
      </div>

      {/* The page scrolls here rather than in the document. The inner box takes
          a full screen at minimum and grows past it when the card is taller than
          the phone in landscape — centring against a box that can grow is what
          keeps the logo reachable instead of cropped off the top. */}
      <div className="relative h-full overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-center justify-center px-4 py-10">
          <main className="relative w-full max-w-md">
            <div className="mb-8 flex flex-col items-center text-center">
              <Logo className="h-20 w-20 drop-shadow-lg" />
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white">Abalone</h1>
              <p className="mt-2 text-sm text-white/50">{t('common:home.tagline')}</p>
            </div>

            <div className="space-y-3 rounded-2xl bg-surface-2 p-6 shadow-2xl shadow-black/40">
              <Button variant="primary" size="lg" className="w-full" onClick={() => setComingSoonOpen(true)}>
                <WifiIcon size={20} />
                {t('common:home.play_online')}
              </Button>

              <Button variant="secondary" size="lg" className="w-full" onClick={onPlayOffline}>
                <GroupIcon size={20} />
                {t('common:home.play_offline')}
              </Button>
            </div>

            {/* A link, not a third button: learning the rules is not one of the
                two things this screen is for, but it has to be findable from it. */}
            <p className="mt-5 text-center">
              <TapButton
                onClick={onOpenRules}
                className="rounded text-sm text-white/60 underline underline-offset-4 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t('common:home.rules_link')}
              </TapButton>
            </p>
          </main>
        </div>
      </div>

      {/* Outside the scroller too: dragging on the backdrop should move nothing. */}
      <Modal
        open={comingSoonOpen}
        onClose={() => setComingSoonOpen(false)}
        title={t('common:home.soon_title')}
        footer={
          <>
            <Button variant="primary" className="flex-1" onClick={onPlayOffline}>
              {t('common:home.play_offline')}
            </Button>
            <Button variant="ghost" onClick={() => setComingSoonOpen(false)}>
              {t('common:actions.close')}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-white/70">{t('common:home.soon_body')}</p>
      </Modal>
    </div>
  );
}
