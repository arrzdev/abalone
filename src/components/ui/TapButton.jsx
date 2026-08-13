import { useClickFix } from '../../hooks/useClickFix.js';

/**
 * A button that presses on the release of the tap that pressed it rather than on
 * the click that follows — see `useClickFix` for what iOS does to the click.
 *
 * In every other respect a plain `<button>`: it takes what a button takes and
 * paints nothing of its own. `Button` is the app's *styled* button and does the
 * same thing already; this is for the controls that are their own shape — board
 * tiles, carousel dots, rows of the move list — which is most of the places two
 * taps land in quick succession.
 */
export function TapButton({ onClick, type = 'button', ...props }) {
  const tap = useClickFix(onClick);
  return <button type={type} {...tap} {...props} />;
}
