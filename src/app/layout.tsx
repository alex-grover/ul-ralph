import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarLayout,
  SidebarTrigger,
  ListsSidebarContent,
} from "@/components/sidebar";
import { NewListButtonClient } from "@/components/new-list-button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ultralight Gear Tracker",
  description: "Track your backpacking gear weight and optimize your pack",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar-open");
  const defaultOpen = sidebarCookie?.value === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <Sidebar>
              <SidebarHeader>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Ultralight
                </span>
              </SidebarHeader>
              <SidebarContent>
                <ListsSidebarContent />
              </SidebarContent>
            </Sidebar>
            <SidebarLayout>
              <AppHeader />
              {children}
            </SidebarLayout>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <SidebarTrigger />
      <div className="flex-1" />
      <NewListButton />
    </header>
  );
}

function NewListButton() {
  return <NewListButtonClient />;
}
