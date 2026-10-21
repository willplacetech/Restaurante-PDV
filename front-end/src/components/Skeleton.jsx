import React from 'react';

const Skeleton = ({ width = '100%', height = '1rem', radius = '4px', className }) => {
  return (
    <div
      className={`skeleton ${className || ''}`}
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: '#e0e0e0',
        '@keyframes shimmer': {
          from: { backgroundPosition: '200% 50%' },
          to: { backgroundPosition: '-100% 50%' },
        },
        animation: 'shimmer 2s infinite linear',
        background:
          'linear-gradient(267deg, #e0e0e0 10%, #f5f5f5 25%, #e0e0e0 40%)',
      }}
    />
  );
};

Skeleton.Grid = ({ rows = 4, cols = 3, className }) => {
  const items = [];
  for (let i = 0; i < rows * cols; i++) {
    items.push(
      <Skeleton key={i} width={`calc(100% / ${cols})`} height="1rem" radius="2px" />
    );
  }
  return <div className={`skeleton-grid ${className || ''}`}>{items}</div>;
};

export default Skeleton;