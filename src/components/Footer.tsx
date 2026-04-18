import { Brain, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="relative border-t border-border/30 mt-16" style={{ background: "hsl(222 30% 5% / 0.8)" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 border border-primary/12 flex items-center justify-center">
                <Brain className="w-3 h-3 text-primary" />
              </div>
              <span className="font-display font-bold text-sm text-foreground">AQT</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Agentic Document Extraction Platform. AI-powered data intelligence.
            </p>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-3 text-xs tracking-wide">Platform</h4>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <Link to="/upload" className="block hover:text-foreground transition-colors">Extract</Link>
              <Link to="/schemas" className="block hover:text-foreground transition-colors">Schemas</Link>
              <Link to="/sessions" className="block hover:text-foreground transition-colors">Sessions</Link>
              <Link to="/jobs" className="block hover:text-foreground transition-colors">Jobs</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-3 text-xs tracking-wide">Resources</h4>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <Link to="/dashboard" className="block hover:text-foreground transition-colors">Dashboard</Link>
              <Link to="/aliases" className="block hover:text-foreground transition-colors">Aliases</Link>
              <Link to="/files" className="block hover:text-foreground transition-colors">Downloads</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-3 text-xs tracking-wide">Connect</h4>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <a
                href={`${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"}/docs`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                API Docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border/20 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            © {new Date().getFullYear()} AQT Data Intelligence
          </span>
        </div>
      </div>
    </footer>
  );
}