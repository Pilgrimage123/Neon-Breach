import React from 'react';

export interface FormattedTextProps {
  text: string;
  className?: string;
  boldClassName?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  className,
  boldClassName = 'font-bold text-white',
}) => {
  if (!text.includes('**')) {
    return className ? <span className={className}>{text}</span> : <>{text}</>;
  }

  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  const content = segments.map((segment, index) => {
    if (segment.startsWith('**') && segment.endsWith('**') && segment.length > 4) {
      return (
        <strong key={index} className={boldClassName}>
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={index}>{segment}</React.Fragment>;
  });

  return className ? <span className={className}>{content}</span> : <>{content}</>;
};

export default FormattedText;
