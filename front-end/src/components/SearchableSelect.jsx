import { useState, useRef, useEffect } from 'react';

const SearchableSelect = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Selecionar',
  searchPlaceholder = 'Buscar...',
  disabled,
  className,
}) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(search.toLowerCase()) ||
      option.value.toString().toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
    if (event.key === 'ArrowDown') {
      setOpen(true);
      if (inputRef.current) inputRef.current.focus();
    }
    if (event.key === 'ArrowUp') {
      setOpen(true);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  useEffect(() => {
    setSearch('');
  }, [value]);

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 8 }}>
          {label}
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border-light)',
            borderRadius: 6,
            fontSize: 12,
            minWidth: 200,
            outline: 'none',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {open && (
        <div
          style={{
            marginTop: 4,
            maxHeight: 200,
            overflow: 'auto',
            border: '1px solid var(--border-light)',
            borderRadius: 6,
            background: 'var(--bg-secondary)',
            fontSize: 12,
          }}
        >
          {filteredOptions.length
            ? filteredOptions.map((option) => (
                <div
                  key={option.value}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                  }
                  onClick={() => onChange(option.value)}
                  onMouseOver={() => {}}
                >
                  {option.label}
                </div>
              ))
            : <div
                style={{
                  padding: '6px 10px',
                  cursor: 'default',
                  color: 'var(--text-tertiary)',
                  fontStyle: 'italic',
                }}
              >
                Nenhum resultado encontrado
              }
          }
        </div>
      )}
    </div>
  );
};

SearchableSelect.defaultProps = {
  options: [],
};

export default SearchableSelect;