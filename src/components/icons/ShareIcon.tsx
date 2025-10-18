type ShareIconProps = {
  small?: boolean;
  className?: string;
};

export function ShareIcon({ small = false, className = "" }: ShareIconProps) {
  const sizeClass = small ? "size-3" : "size-4";

  return (
    <svg
      className={`${sizeClass} ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M15.5 5.5L20.5 10.5L15.5 15.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 10.5H10.5C7.73858 10.5 5.5 12.7386 5.5 15.5V18.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
