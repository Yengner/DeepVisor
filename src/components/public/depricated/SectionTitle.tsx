import React from 'react';

interface SectionTitleProps {
  children: React.ReactElement<{ className?: string }>;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ children }) => {
  return React.cloneElement(children, {
    className: `${children.props.className || ""} text-3xl lg:text-5xl lg:leading-tight font-bold`,
  });
};

export default SectionTitle;
