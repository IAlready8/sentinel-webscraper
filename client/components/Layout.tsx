import { Link, NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="sr-only">Enterprise Scraper</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <NavItem to="/" label="Home" />
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/scraper" label="Scraper" />
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/dashboard">
            <Button className="bg-primary text-primary-foreground hover:opacity-90">
              Open Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "transition-colors hover:text-foreground/80",
          isActive ? "text-foreground" : "text-foreground/60",
        )
      }
      end
    >
      {label}
    </NavLink>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="container py-8 text-sm text-foreground/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo small />
          <span>Enterprise-Grade Web Scraping System</span>
        </div>
        <div className="flex items-center gap-4">
          <a className="hover:text-foreground/80" href="/dashboard">
            Status
          </a>
          <a className="hover:text-foreground/80" href="/">
            Home
          </a>
        </div>
      </div>
    </footer>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "rounded-md bg-gradient-to-br from-primary to-accent",
          small ? "h-6 w-6" : "h-8 w-8",
        )}
      />
      <span
        className={cn(
          "font-semibold tracking-tight",
          small ? "text-base" : "text-xl",
        )}
      >
        Sentinel
      </span>
    </div>
  );
}
