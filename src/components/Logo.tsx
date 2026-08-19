import React from 'react';

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 24, style, ...props }) => {
  return (
    <img
      src="/icon-128.png"
      alt="Filli AI Logo"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: '8px', ...style }}
      className={className}
      {...props}
    />
  );
};

