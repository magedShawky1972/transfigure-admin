// ASUS Card logo for print documents
// This logo is used in all reports and print documents except Order Payment Report invoice

import asusCardLogo from "@/assets/asus-card-logo.jpg";

export const PRINT_LOGO_PATH = asusCardLogo;

// For use in dynamic HTML print windows (need to use absolute URL)
export const getPrintLogoUrl = () => {
  // Get the absolute URL for the logo
  return new URL(asusCardLogo, window.location.origin).href;
};

// Logo styling for print headers
export const PRINT_LOGO_STYLES = {
  width: "120px",
  height: "auto",
  marginBottom: "10px",
};
