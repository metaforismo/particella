import { Audiences } from "@/components/landing/Audiences";
import { FinalCta } from "@/components/landing/FinalCta";
import { Fragmentation } from "@/components/landing/Fragmentation";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LayerLegend } from "@/components/landing/LayerLegend";
import { Products } from "@/components/landing/Products";
import { heroExample } from "@/content/hero-example";

export default function HomePage() {
  return (
    <>
      <Hero example={heroExample} />
      <Fragmentation />
      <HowItWorks />
      <Products />
      <LayerLegend />
      <Audiences />
      <FinalCta />
    </>
  );
}
