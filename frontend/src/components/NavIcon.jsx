const ICONS = {
  '/tickets': '<path d="M4 6h16v12H4z"/><path d="M8 6V4h8v2"/><path d="M8 11h8"/><path d="M8 15h5"/>',
  '/tickets/new': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/>',
  '/masters/departments': '<path d="M3 21h18"/><path d="M6 21V9l6-3 6 3v12"/><path d="M10 13h4v8"/>',
  '/masters/roles': '<circle cx="12" cy="8" r="4"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/>',
  '/masters/employees': '<circle cx="9" cy="8" r="3"/><path d="M4 21v-1a5 5 0 0 1 5-5"/><circle cx="17" cy="10" r="2.5"/><path d="M14 21v-1a4 4 0 0 1 4-3"/>',
  '/masters/categories': '<path d="M4 7h7v7H4z"/><path d="M13 7h7v4h-7z"/><path d="M13 13h7v7h-7z"/><path d="M4 16h7v4H4z"/>',
  '/masters/locations': '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="11" r="2"/>',
};

export default function NavIcon({ to }) {
  const paths = ICONS[to] || ICONS['/tickets'];
  return (
    <span
      className="nav-icon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: `<svg viewBox="0 0 24 24">${paths}</svg>`,
      }}
    />
  );
}
