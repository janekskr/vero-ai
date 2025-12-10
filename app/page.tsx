import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import SecureFeatures from "@/components/SecureFeatures";

export default function Home() {
  return (
    <div className="min-h-screen scroll-smooth">
      <Header />
      <main>
        <Hero />
        <Features />
        <SecureFeatures />
      </main>
      <Footer />
    </div>
  );
}
