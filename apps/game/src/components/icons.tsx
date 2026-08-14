import type { LucideIcon } from "lucide-react"
import {
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  CircleQuestionMark,
  Eye,
  EyeOff,
  Flag,
  History,
  House,
  Image as ImageGlyph,
  Info,
  Lightbulb,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Settings,
  Undo2,
  User,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from "lucide-react"
import type { SVGProps } from "react"

/**
 * Every glyph in the app, as Lucide strokes behind the app's own names.
 *
 * The names are the app's rather than the library's — `RematchIcon`, not
 * `RefreshCw` — because a screen asks for the thing it means, and swapping the
 * set underneath is then this file and nothing else. It was a hand-copied set of
 * Material paths before this.
 *
 * `ref` is off the props on purpose: nothing here is measured or focused, and
 * dropping it keeps the shape assignable straight into Lucide's own.
 */

export type IconProps = Omit<
  SVGProps<SVGSVGElement>,
  "children" | "ref"
> & {
  size?: number
}

function glyph(Glyph: LucideIcon) {
  return function Icon(props: IconProps) {
    return <Glyph aria-hidden="true" focusable="false" {...props} />
  }
}

export const CloseIcon = glyph(X)
export const ChevronLeftIcon = glyph(ChevronLeft)
export const ChevronRightIcon = glyph(ChevronRight)

/** Two chevrons — "jump to the live position". */
export const ChevronDoubleRightIcon = glyph(ChevronsRight)

/** The leading edge of a bar. Same chevron as the lists use, by design. */
export const BackIcon = glyph(ChevronLeft)

export const FlagIcon = glyph(Flag)
export const RematchIcon = glyph(RefreshCw)
export const PlusIcon = glyph(Plus)
export const SettingsIcon = glyph(Settings)
export const RobotIcon = glyph(Bot)
export const PersonIcon = glyph(User)
export const ChevronDownIcon = glyph(ChevronDown)
export const CheckIcon = glyph(Check)
export const RotateIcon = glyph(RotateCw)
export const GroupIcon = glyph(Users)
export const LightbulbIcon = glyph(Lightbulb)
export const UndoIcon = glyph(Undo2)
export const HistoryIcon = glyph(History)
export const VolumeUpIcon = glyph(Volume2)
export const VolumeOffIcon = glyph(VolumeX)
export const PlayIcon = glyph(Play)
export const InfoIcon = glyph(Info)

/** The rules, in the chrome: a question mark is what a stranger looks for. */
export const HelpIcon = glyph(CircleQuestionMark)

export const LogoutIcon = glyph(LogOut)
export const LoginIcon = glyph(LogIn)
export const WifiIcon = glyph(Wifi)
export const HomeIcon = glyph(House)

/** Change picture: a photo, not a camera — the source is the library. */
export const ImageIcon = glyph(ImageGlyph)

export const EyeIcon = glyph(Eye)
export const EyeOffIcon = glyph(EyeOff)
