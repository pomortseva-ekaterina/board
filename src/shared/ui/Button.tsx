import type { ComponentPropsWithoutRef } from 'react';

export default function Button({ style, ...props }: ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      style={{
        ...style,
        display: 'block',
        padding: '8px 16px',
        background: props.disabled ? '#333' : '#f0f0f0',
        color: props.disabled ? '#666' : '#0a0a0a',
        border: 'none',
        borderRadius: 3,
        fontSize: 13,
        fontWeight: 600,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'monospace',
      }}
      {...props}
    />
  );
}
