import { useState, useRef } from 'react';

const SearchableSelect = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Buscar...',
  searchPlaceholder = placeholder,
  disabled,
  className,
}) => {
  const [searchState, setSearchState] = useState(() => ({ value, search: '' }));
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const search = Object.is(searchState.value, value) ? searchState.search : '';
  const updateSearch = (nextSearch) => setSearchState({ value, search: nextSearch });

  const filteredOptions = options.filter(
    (option) => String(option.label ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(option.value ?? '').toLowerCase().includes(search.toLowerCase())
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
          onChange={(e) => updateSearch(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
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
                  role="option"
                  aria-selected={Object.is(option.value, value)}
                  aria-disabled={disabled}
                  style={{
                    padding: '6px 10px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    borderBottom: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                  }}
                  onClick={() => {
                    if (disabled) return;
                    onChange(option.value);
                    updateSearch('');
                    setOpen(false);
                  }}
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
          </div>
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