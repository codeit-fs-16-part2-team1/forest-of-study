import "./appLayout.scss";

const AppLayout = ({ header, children, className = "" }) => {
  const layoutClassName = ["appLayout", className].filter(Boolean).join(" ");

  return (
    <div className={layoutClassName}>
      {header != null && <div className="appLayout__header">{header}</div>}
      <main className="appLayout__main">{children}</main>
    </div>
  );
};

export default AppLayout;
