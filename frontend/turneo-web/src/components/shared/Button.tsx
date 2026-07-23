import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonShape = "default" | "pill";
type ButtonSize = "default" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  shape?: ButtonShape;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-blush text-cream shadow-glow hover:bg-blushdark",
  secondary: "bg-porcelain/5 text-charcoal border border-mauve/15 hover:bg-porcelain/10 hover:border-mauve/30",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

const shapeClasses: Record<ButtonShape, string> = {
  default: "rounded-lg",
  pill: "rounded-full hover:scale-[1.02]",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "px-6 py-3 text-sm font-semibold",
  sm: "px-3 py-1.5 text-xs font-medium",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", shape = "default", size = "default", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${variantClasses[variant]} ${shapeClasses[shape]} ${sizeClasses[size]} transition disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
