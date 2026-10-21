export const exportToCSV = (headers, rows) => {
  if (!headers || !rows || rows.length === 0) return '';

  const headerRow = headers.map((h) => `"${h}"`).join(',');
  const dataRows = rows.map((row) =>
    headers.map((h) => {
      const value = row[h] !== undefined && row[h] !== null ? row[h] : '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
};

export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};