import { useEffect, useState } from "react";
import logoPurple from "@/assets/edara-logo.png";
import logoNavy from "@/assets/edara-logo-navy.png";

interface ThemedLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

/**
 * Renders the Edara logo, automatically swapping to the navy variant in light
 * mode and the purple variant in dark mode. Reacts to runtime theme changes.
 */
export const ThemedLogo = ({ alt = "Edara Logo", ...props }: ThemedLogoProps) => {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <img src={isDark ? logoPurple : logoNavy} alt={alt} {...props} />;
};

export default ThemedLogo;
