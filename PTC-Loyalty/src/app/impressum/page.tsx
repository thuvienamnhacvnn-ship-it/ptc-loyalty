import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Impressum",
  description:
    "Impressum der A&T VisioInvestment GmbH — Anbieterkennzeichnung gemäß § 5 TMG.",
};

// German legal notice (Impressum) — required by § 5 TMG. Shows the operating
// company's legal details so they can be cross-checked against official records
// (Handelsregister, Finanzamt) — also used by Meta for business verification.
export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum" updated="27.07.2026">
      <h2>Angaben gemäß § 5 TMG</h2>
      <p>
        <strong>A&amp;T VisioInvestment GmbH</strong>
        <br />
        Kranoldstraße 24
        <br />
        12621 Berlin
        <br />
        Deutschland
      </p>

      <h2>Vertreten durch</h2>
      <p>
        Geschäftsführer: <strong>Tran Quang Tuyen</strong>
      </p>

      <h2>Kontakt</h2>
      {/*
        Số này KHÁC hotline ở trang /contact (0152 23758632) và đó là CỐ Ý, không
        phải lỗi gõ nhầm — đừng "sửa" cho giống nhau:
          · đây là số pháp lý của pháp nhân A&T VisioInvestment GmbH, cũng là số
            đã khai trong Meta Business Info, đổi là lệch hồ sơ bên Meta;
          · còn kia là hotline khách hàng của PTC Creative, cũng là số WhatsApp.
      */}
      <p>
        Telefon: <strong>+49 152 37376688</strong>
        <br />
        E-Mail: <strong>ptc.creative.vn@gmail.com</strong>
        <br />
        Website: <strong>https://ptc-bonus.com</strong>
      </p>

      <h2>Registereintrag</h2>
      <p>
        Eintragung im Handelsregister.
        <br />
        Registergericht: <strong>Amtsgericht Charlottenburg (Berlin)</strong>
        <br />
        Registernummer: <strong>HRB 243305</strong>
      </p>

      <h2>Steuernummer</h2>
      <p>
        <strong>37/212/53053</strong>
        <br />
        Finanzamt für Körperschaften II, Berlin
      </p>

      <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
      <p>
        Tran Quang Tuyen
        <br />
        A&amp;T VisioInvestment GmbH
        <br />
        Kranoldstraße 24, 12621 Berlin
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf
        diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis
        10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte
        oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
        forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
      </p>

      <h2>Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
        (OS) bereit: https://ec.europa.eu/consumers/odr. Wir sind nicht bereit oder
        verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </LegalPage>
  );
}
