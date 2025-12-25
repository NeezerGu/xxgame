import React from "react";
import { buildDiagnosticsPayload } from "../utils/diagnostics";
import { copyText } from "../utils/clipboard";
import { getDefaultLocale, t, type Locale } from "../i18n";
import { LOCALE_STORAGE_KEY, SAVE_KEY, TAB_STORAGE_KEY } from "../constants/storage";
import { safeReadStorage } from "../utils/storage";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
  copyStatus: "idle" | "success" | "fail";
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, copyStatus: "idle" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, copyStatus: "idle" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("ErrorBoundary caught error", error, info);
  }

  private getLocale(): Locale {
    const saved = safeReadStorage(LOCALE_STORAGE_KEY);
    if (saved === "zh-CN" || saved === "en-US") {
      return saved;
    }
    return getDefaultLocale();
  }

  private buildDiagnostics(locale: Locale): string {
    const tab = safeReadStorage(TAB_STORAGE_KEY);
    const save = safeReadStorage(SAVE_KEY);

    return buildDiagnosticsPayload({
      locale,
      tab,
      save,
      errorMessage: this.state.error?.message ?? "Unknown error"
    });
  }

  private handleCopyDiagnostics = async (): Promise<void> => {
    const locale = this.getLocale();
    const success = await copyText(this.buildDiagnostics(locale));
    this.setState({ copyStatus: success ? "success" : "fail" });
  };

  private handleReset = (): void => {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    const locale = this.getLocale();
    const copyStatusLabel =
      this.state.copyStatus === "success"
        ? t("safety.copyOk", undefined, locale)
        : this.state.copyStatus === "fail"
          ? t("safety.copyFail", undefined, locale)
          : null;

    return (
      <main className="page">
        <section className="card">
          <div className="card-header">
            <div>
              <h2>{t("safety.crashTitle", undefined, locale)}</h2>
              <p className="muted small">{t("safety.crashHint", undefined, locale)}</p>
            </div>
          </div>
          <div className="muted small" style={{ marginBottom: "0.5rem" }}>
            {this.state.error?.message}
          </div>
          <div className="dev-controls">
            <button className="action-button secondary" onClick={this.handleCopyDiagnostics}>
              {t("safety.copyDiagnostics", undefined, locale)}
            </button>
            <button className="action-button secondary" onClick={this.handleReset}>
              {t("safety.reset", undefined, locale)}
            </button>
            <button className="action-button secondary" onClick={this.handleReload}>
              {t("safety.reload", undefined, locale)}
            </button>
          </div>
          {copyStatusLabel ? <div className="muted small">{copyStatusLabel}</div> : null}
        </section>
      </main>
    );
  }
}
