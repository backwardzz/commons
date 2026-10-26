// Собственные иконки 16×16, рисуются цветом текста.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const IconBook = (p: P) => <Svg {...p}><path d="M2.5 3.2c0-.6.5-1 1-1h3.2c.7 0 1.3.6 1.3 1.3v10c0-.6-.5-1-1.1-1H3.5c-.5 0-1-.4-1-1V3.2Z" /><path d="M13.5 3.2c0-.6-.5-1-1-1H9.3C8.6 2.2 8 2.8 8 3.5v10c0-.6.5-1 1.1-1h3.4c.5 0 1-.4 1-1V3.2Z" /></Svg>;
export const IconIssue = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.2" /><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" /></Svg>;
export const IconIssueDone = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.2" /><path d="m5.4 8.2 1.8 1.8 3.4-3.6" /></Svg>;
export const IconIssueDeclined = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.2" /><path d="m4 12 8-8" /></Svg>;
export const IconIssueProposed = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.2" strokeDasharray="2.4 2.2" /></Svg>;
export const IconPull = (p: P) => <Svg {...p}><circle cx="4" cy="3.5" r="1.6" /><circle cx="4" cy="12.5" r="1.6" /><circle cx="12" cy="12.5" r="1.6" /><path d="M4 5.1v5.8" /><path d="M12 10.9V6.5c0-1.1-.9-2-2-2H7.5" /><path d="m9 3 -1.5 1.5L9 6" /></Svg>;
export const IconPullMerged = (p: P) => <Svg {...p}><circle cx="4" cy="3.5" r="1.6" /><circle cx="4" cy="12.5" r="1.6" /><circle cx="12" cy="8.5" r="1.6" /><path d="M4 5.1v5.8" /><path d="M4.6 5c.8 2.2 2.8 3.5 5.8 3.5" /></Svg>;
export const IconPullClosed = (p: P) => <Svg {...p}><circle cx="4" cy="3.5" r="1.6" /><circle cx="4" cy="12.5" r="1.6" /><circle cx="12" cy="12.5" r="1.6" /><path d="M4 5.1v5.8" /><path d="M12 7.5v3.4" /><path d="m10.4 2.4 3.2 3.2M13.6 2.4l-3.2 3.2" /></Svg>;
export const IconComment = (p: P) => <Svg {...p}><path d="M2.5 4c0-.8.7-1.5 1.5-1.5h8c.8 0 1.5.7 1.5 1.5v5.5c0 .8-.7 1.5-1.5 1.5H7l-3 2.5V11h0c-.8 0-1.5-.7-1.5-1.5V4Z" /></Svg>;
export const IconDiscussion = (p: P) => <Svg {...p}><path d="M1.8 3.3c0-.7.6-1.3 1.3-1.3h6.2c.7 0 1.3.6 1.3 1.3v3.9c0 .7-.6 1.3-1.3 1.3H5.4L3 10.5V8.5c-.7 0-1.2-.6-1.2-1.3V3.3Z" /><path d="M12.2 5.5h.7c.7 0 1.3.6 1.3 1.3v3.9c0 .7-.6 1.3-1.3 1.3V14l-2.4-2H7.7c-.7 0-1.3-.6-1.3-1.3v-.4" /></Svg>;
export const IconTag = (p: P) => <Svg {...p}><path d="M2.2 2.8v4.1c0 .4.2.8.4 1l5.6 5.6c.6.6 1.5.6 2 0l3.3-3.3c.6-.6.6-1.5 0-2L7.9 2.6c-.3-.3-.6-.4-1-.4H2.8c-.3 0-.6.3-.6.6Z" /><circle cx="5.2" cy="5.2" r="1" fill="currentColor" stroke="none" /></Svg>;
export const IconHistory = (p: P) => <Svg {...p}><path d="M2.3 8a5.7 5.7 0 1 0 1.7-4" /><path d="M2 1.8v2.6h2.6" /><path d="M8 5v3.2l2 1.3" /></Svg>;
export const IconGear = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="2.1" /><path d="M8 1.6v1.6M8 12.8v1.6M14.4 8h-1.6M3.2 8H1.6M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6 3.5 3.5" /></Svg>;
export const IconEye = (p: P) => <Svg {...p}><path d="M1.5 8S3.8 3.5 8 3.5 14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="1.9" /></Svg>;
export const IconFork = (p: P) => <Svg {...p}><circle cx="4" cy="3.3" r="1.5" /><circle cx="12" cy="3.3" r="1.5" /><circle cx="8" cy="12.7" r="1.5" /><path d="M4 4.8v.9c0 1 .8 1.8 1.8 1.8h4.4c1 0 1.8-.8 1.8-1.8v-.9M8 7.5v3.7" /></Svg>;
export const IconSpark = (p: P) => <Svg {...p}><path d="M8 1.8c.3 2.9 1.4 4 4.2 4.2-2.8.3-3.9 1.4-4.2 4.2-.3-2.8-1.4-3.9-4.2-4.2 2.8-.2 3.9-1.3 4.2-4.2Z" /><path d="M12.5 10.3c.1 1.2.6 1.7 1.7 1.8-1.1.1-1.6.6-1.7 1.7-.1-1.1-.6-1.6-1.8-1.7 1.2-.1 1.7-.6 1.8-1.8Z" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m3.2 8.4 3 3 6.6-6.8" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="m4.5 6.2 3.5 3.5 3.5-3.5" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="7" cy="7" r="4.4" /><path d="m10.3 10.3 3.4 3.4" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>;
export const IconFile = (p: P) => <Svg {...p}><path d="M4 1.8h5l3.2 3.2v8.2c0 .6-.5 1-1 1H4c-.6 0-1-.4-1-1V2.8c0-.6.4-1 1-1Z" /><path d="M9 1.8V5h3.2" /></Svg>;
export const IconLink = (p: P) => <Svg {...p}><path d="M6.7 9.3a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.8.8" /><path d="M9.3 6.7a2.6 2.6 0 0 0-3.7 0L3.4 8.9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" /></Svg>;
export const IconPeople = (p: P) => <Svg {...p}><circle cx="6" cy="5.5" r="2.3" /><path d="M1.8 13.3c.4-2.2 2.1-3.6 4.2-3.6s3.8 1.4 4.2 3.6" /><path d="M10.5 3.4a2.2 2.2 0 1 1 0 4.3M11.8 9.9c1.3.4 2.2 1.6 2.4 3.4" /></Svg>;
export const IconFlag = (p: P) => <Svg {...p}><path d="M3.5 14.2V2.4" /><path d="M3.5 2.8h8.2l-1.8 2.8 1.8 2.8H3.5" /></Svg>;
export const IconBoard = (p: P) => <Svg {...p}><rect x="1.8" y="2.3" width="12.4" height="11.4" rx="1.3" /><path d="M6 2.3v11.4M10 2.3v11.4" /></Svg>;
export const IconList = (p: P) => <Svg {...p}><path d="M5.5 4h8M5.5 8h8M5.5 12h8" /><circle cx="2.6" cy="4" r=".6" fill="currentColor" /><circle cx="2.6" cy="8" r=".6" fill="currentColor" /><circle cx="2.6" cy="12" r=".6" fill="currentColor" /></Svg>;
export const IconPencil = (p: P) => <Svg {...p}><path d="M10.6 2.6a1.5 1.5 0 0 1 2.1 2.1l-7.6 7.6-2.8.7.7-2.8 7.6-7.6Z" /></Svg>;
export const IconDot = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" /></Svg>;
export const IconUser = (p: P) => <Svg {...p}><circle cx="8" cy="5.5" r="2.7" /><path d="M2.8 14c.5-2.6 2.6-4.3 5.2-4.3s4.7 1.7 5.2 4.3" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><path d="M7.1 2.6 1.9 12c-.4.7.1 1.6.9 1.6h10.4c.8 0 1.3-.9.9-1.6L8.9 2.6c-.4-.7-1.4-.7-1.8 0Z" /><path d="M8 6.3v3" /><circle cx="8" cy="11.4" r=".5" fill="currentColor" /></Svg>;
export const IconArrowLeft = (p: P) => <Svg {...p}><path d="M13 8H3.5M7.5 4 3.5 8l4 4" /></Svg>;
export const IconLock = (p: P) => <Svg {...p}><rect x="3" y="7" width="10" height="7" rx="1.3" /><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7" /></Svg>;
export const IconGlobe = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="6.2" /><path d="M1.8 8h12.4M8 1.8c1.7 1.8 2.5 3.9 2.5 6.2S9.7 12.4 8 14.2C6.3 12.4 5.5 10.3 5.5 8S6.3 3.6 8 1.8Z" /></Svg>;
export const IconMore = (p: P) => <Svg {...p}><circle cx="3.5" cy="8" r=".9" fill="currentColor" /><circle cx="8" cy="8" r=".9" fill="currentColor" /><circle cx="12.5" cy="8" r=".9" fill="currentColor" /></Svg>;
export const IconSun = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="2.8" /><path d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" /></Svg>;
export const IconMoon = (p: P) => <Svg {...p}><path d="M13.4 9.6A5.6 5.6 0 0 1 6.4 2.6a5.6 5.6 0 1 0 7 7Z" /></Svg>;
export const IconChart = (p: P) => <Svg {...p}><path d="M2.5 13.5h11" /><path d="M4.5 11V8M8 11V4.5M11.5 11V6.5" /></Svg>;
export const IconMail = (p: P) => <Svg {...p}><rect x="2" y="3.5" width="12" height="9" rx="1.4" /><path d="m2.6 4.4 5.4 4.1 5.4-4.1" /></Svg>;
export const IconShare = (p: P) => <Svg {...p}><path d="M8 10V2.2M5.2 4.8 8 2l2.8 2.8" /><path d="M4.5 7H3.8c-.7 0-1.3.6-1.3 1.3v4.4c0 .7.6 1.3 1.3 1.3h8.4c.7 0 1.3-.6 1.3-1.3V8.3c0-.7-.6-1.3-1.3-1.3h-.7" /></Svg>;
export const IconTranslate = (p: P) => <Svg {...p}><path d="M2 3.5h6.5M5.2 2v1.5M3.3 3.5c.4 2 1.8 3.7 3.7 4.6M7.2 3.5C6.8 5.6 5.4 7.4 3 8.6" /><path d="m8.5 14 2.7-6.5L14 14M9.4 12h3.6" /></Svg>;
