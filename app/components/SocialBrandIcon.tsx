type SocialBrand = "facebook" | "instagram" | "youtube" | "discord" | "telegram";

type SocialBrandIconProps = {
  brand: SocialBrand;
  size?: number;
  className?: string;
};

export function SocialBrandIcon({ brand, size = 20, className }: SocialBrandIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
    focusable: false,
    className: `social-brand-icon${className ? ` ${className}` : ""}`,
  } as const;

  if (brand === "facebook") {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M13.62 21v-8.2h2.75l.41-3.2h-3.16V7.56c0-.93.26-1.56 1.59-1.56h1.69V3.15A22.7 22.7 0 0 0 14.44 3c-2.44 0-4.11 1.49-4.11 4.23V9.6H7.57v3.2h2.76V21h3.29Z" />
      </svg>
    );
  }

  if (brand === "instagram") {
    return (
      <svg {...common}>
        <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5.2" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.15" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.45" cy="6.75" r="1.15" fill="currentColor" />
      </svg>
    );
  }

  if (brand === "youtube") {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M21.48 7.14a2.5 2.5 0 0 0-1.76-1.77C18.16 4.95 12 4.95 12 4.95s-6.16 0-7.72.42a2.5 2.5 0 0 0-1.76 1.77A26 26 0 0 0 2.1 12c0 1.62.14 3.24.42 4.86a2.5 2.5 0 0 0 1.76 1.77c1.56.42 7.72.42 7.72.42s6.16 0 7.72-.42a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 21.9 12c0-1.62-.14-3.24-.42-4.86Z" />
        <path fill="#fff" d="m10 15.05 5.2-3.05L10 8.95v6.1Z" />
      </svg>
    );
  }

  if (brand === "discord") {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M19.54 5.34A18.8 18.8 0 0 0 15 3.92l-.56 1.14a17.3 17.3 0 0 0-4.88 0L9 3.92a18.7 18.7 0 0 0-4.55 1.42C1.57 9.6.79 13.76 1.18 17.86a18.5 18.5 0 0 0 5.58 2.82l1.36-1.85a11.8 11.8 0 0 1-2.14-1.03l.52-.4a13.5 13.5 0 0 0 11 0l.52.4c-.68.41-1.4.76-2.14 1.03l1.36 1.85a18.5 18.5 0 0 0 5.58-2.82c.47-4.75-.8-8.87-3.28-12.52ZM8.38 15.36c-1.08 0-1.96-.99-1.96-2.2 0-1.22.86-2.21 1.96-2.21 1.11 0 1.99 1 1.97 2.2 0 1.22-.87 2.21-1.97 2.21Zm7.24 0c-1.08 0-1.96-.99-1.96-2.2 0-1.22.86-2.21 1.96-2.21 1.11 0 1.99 1 1.97 2.2 0 1.22-.86 2.21-1.97 2.21Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path fill="currentColor" d="M20.67 3.52 2.96 10.35c-1.2.49-1.2 1.16-.22 1.46l4.55 1.42 1.74 5.33c.21.59.1.82.72.82.48 0 .7-.22.96-.47l2.18-2.12 4.53 3.35c.84.46 1.44.22 1.65-.78l2.99-14.09c.3-1.22-.47-1.77-1.39-1.75ZM8 12.91l10.49-6.62c.52-.31.99-.14.6.21l-8.66 7.82-.34 3.65L8 12.91Z" />
    </svg>
  );
}

export type { SocialBrand };
