"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer as DrawerPrimitive } from "vaul";
import { useMediaQuery } from "@/hooks/use-media-query";

const DESKTOP_BREAKPOINT = "(min-width: 1024px)";
const SIDEBAR_COOKIE_NAME = "sidebar-open";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

interface ListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SidebarContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isDesktop: boolean;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  isOpen: false,
  setIsOpen: () => {},
  isDesktop: true,
});

export function useSidebar() {
  return React.useContext(SidebarContext);
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

interface SidebarProviderProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SidebarProvider({ children, defaultOpen }: SidebarProviderProps) {
  const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
  const [isOpen, setIsOpenState] = React.useState(() => {
    // On server, use defaultOpen prop
    if (typeof document === "undefined") {
      return defaultOpen ?? false;
    }
    // On client, check cookie first, then default to true on desktop
    const cookieValue = getCookie(SIDEBAR_COOKIE_NAME);
    if (cookieValue !== null) {
      return cookieValue === "true";
    }
    return isDesktop;
  });

  // Update sidebar state when switching between mobile and desktop
  React.useEffect(() => {
    const cookieValue = getCookie(SIDEBAR_COOKIE_NAME);
    if (cookieValue === null) {
      // No cookie set, default to open on desktop, closed on mobile
      setIsOpenState(isDesktop);
    }
  }, [isDesktop]);

  const setIsOpen = React.useCallback((open: boolean) => {
    setIsOpenState(open);
    setCookie(SIDEBAR_COOKIE_NAME, String(open), SIDEBAR_COOKIE_MAX_AGE);
  }, []);

  const contextValue = React.useMemo(
    () => ({ isOpen, setIsOpen, isDesktop }),
    [isOpen, setIsOpen, isDesktop]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
}

interface SidebarProps {
  children?: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const { isOpen, setIsOpen, isDesktop } = useSidebar();

  if (isDesktop) {
    return (
      <aside
        data-state={isOpen ? "open" : "closed"}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-200 bg-white transition-all duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 ${
          isOpen ? "w-64" : "w-0"
        }`}
      >
        <div className={`flex h-full flex-col overflow-hidden ${isOpen ? "opacity-100" : "opacity-0"}`}>
          {children}
        </div>
      </aside>
    );
  }

  return (
    <DrawerPrimitive.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      direction="left"
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DrawerPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {children}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex h-14 shrink-0 items-center border-b border-zinc-200 px-4 dark:border-zinc-800 ${className ?? ""}`}
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex-1 overflow-y-auto ${className ?? ""}`}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`shrink-0 border-t border-zinc-200 p-4 dark:border-zinc-800 ${className ?? ""}`}
      {...props}
    />
  );
}

export function SidebarTrigger({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isOpen, setIsOpen } = useSidebar();

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${className ?? ""}`}
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      {...props}
    >
      <MenuIcon className="h-5 w-5" />
    </button>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, isDesktop } = useSidebar();

  return (
    <div
      className={`min-h-screen transition-all duration-300 ease-in-out ${
        isDesktop && isOpen ? "pl-64" : "pl-0"
      }`}
    >
      {children}
    </div>
  );
}

// Lists sidebar content component
export function ListsSidebarContent() {
  const [lists, setLists] = React.useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const pathname = usePathname();
  const { setIsOpen, isDesktop } = useSidebar();

  React.useEffect(() => {
    async function fetchLists() {
      try {
        const response = await fetch("/api/lists");
        if (response.ok) {
          const data = await response.json();
          setLists(data.lists);
        } else {
          setError("Failed to load lists");
        }
      } catch {
        setError("Failed to load lists");
      } finally {
        setIsLoading(false);
      }
    }

    fetchLists();
  }, []);

  const handleListClick = () => {
    // Close sidebar on mobile when clicking a list
    if (!isDesktop) {
      setIsOpen(false);
    }
  };

  // Extract current list ID from pathname
  const currentListId = pathname?.startsWith("/lists/")
    ? pathname.split("/")[2]
    : null;

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
        {error}
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        My Lists
      </div>
      {lists.length === 0 ? (
        <div className="px-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">
          No lists yet
        </div>
      ) : (
        <nav className="space-y-1">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              onClick={handleListClick}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                currentListId === list.id
                  ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
              }`}
            >
              <ListIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{list.name}</span>
              {list.isPublic && (
                <GlobeIcon className="ml-auto h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
              )}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

// Icons
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM1.99 4.75a1 1 0 011-1H3a1 1 0 011 1v.01a1 1 0 01-1 1h-.01a1 1 0 01-1-1v-.01zM1.99 15.25a1 1 0 011-1H3a1 1 0 011 1v.01a1 1 0 01-1 1h-.01a1 1 0 01-1-1v-.01zM1.99 10a1 1 0 011-1H3a1 1 0 011 1v.01a1 1 0 01-1 1h-.01a1 1 0 01-1-1V10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-1.5 0a6.5 6.5 0 11-11-4.69v.01c.345.384.768.74 1.26 1.035.715.428 1.58.755 2.54.942V8.5a.75.75 0 011.5 0v1.125c.96-.187 1.825-.514 2.54-.942.492-.295.915-.65 1.26-1.035v-.01A6.47 6.47 0 0116.5 10zm-4.03 5.85a5.018 5.018 0 01-4.94 0 4.5 4.5 0 00-.34 1.02c.457.13.927.227 1.405.287a.75.75 0 01-.24 1.48 8.096 8.096 0 01-2.01-.41 6.5 6.5 0 0110.32 0 8.095 8.095 0 01-2.01.41.75.75 0 01-.24-1.48c.478-.06.948-.156 1.405-.287a4.502 4.502 0 00-.34-1.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}
