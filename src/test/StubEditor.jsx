// A plain textarea that stands in for Monaco in tests (jsdom cannot run Monaco).
export default function StubEditor({ path, value, onChange, readOnly }) {
  return (
    <textarea
      aria-label="Code editor"
      data-path={path}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
