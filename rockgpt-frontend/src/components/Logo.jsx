export const LOGO_D =
  "M130.8 0.0L0.0 225.8L0.0 229.0L130.5 454.8L246.2 454.8L220.8 410.5L157.0 409.2L52.5 228.2L158.5 44.5L191.2 44.8L208.2 74.5L118.5 230.8L189.0 353.8L216.0 354.5L323.8 168.8L355.2 223.2L265.0 381.2L307.2 454.8L395.2 454.8L525.8 229.2L525.8 226.0L395.0 0.0L279.5 0.0L305.0 44.2L367.2 44.5L473.5 227.0L368.8 409.2L336.8 410.5L333.8 409.2L317.5 380.0L407.2 222.8L336.8 100.8L310.5 100.0L202.0 286.0L170.8 231.2L261.0 74.2L218.2 0.0Z";

export default function Logo({
  className = "",
  size,
  style = {},
  intro = false,
  draw = false,
  ...props
}) {
  const customStyle = { ...style };
  if (size) {
    customStyle.width = typeof size === "number" ? `${size}px` : size;
  }

  if (intro) {
    return (
      <svg
        className={`il ${className}`}
        viewBox="-6 -6 538 467"
        aria-hidden="true"
        style={customStyle}
        {...props}
      >
        <path pathLength="1" d={LOGO_D} />
      </svg>
    );
  }

  const finalClass = `logo ${draw ? "draw" : ""} ${className}`.trim();

  return (
    <svg
      className={finalClass}
      viewBox="0 0 526 455"
      role="img"
      aria-label="ROCKGPT"
      style={customStyle}
      {...props}
    >
      <path d={LOGO_D} />
    </svg>
  );
}
