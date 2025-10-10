import pitecoImage from "@/assets/piteco-logo.png";

export function PitecoLogo({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <img
      src={pitecoImage}
      alt="Piteco - Mascote APE"
      className={`${className} object-contain drop-shadow-lg`}
    />
  );
}
