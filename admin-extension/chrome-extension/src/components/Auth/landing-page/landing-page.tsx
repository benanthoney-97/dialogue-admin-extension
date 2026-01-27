import "./landing-page.css"

const logoUrl =
  "https://lmnoftavsxqvkpcleehi.supabase.co/storage/v1/object/public/platform_logos/694fab5082d1c37ac311541c_Untitled_design__9_-removebg-preview%20(1).png"

type LandingPageProps = {
  onLogin: () => void
  onSignUp: () => void
}

export function LandingPage({ onLogin, onSignUp }: LandingPageProps) {
  return (
    <div className="landing-page">
      <div className="landing-page__logo-wrapper">
        <img src={logoUrl} alt="Dialogue logo" className="landing-page__logo dialogue-logo" />
      </div>
      <div className="landing-page__content">
        <p>The extension to manage what videos appear across your platforms</p>
      </div>
      <div className="landing-page__video-wrapper">
        <img
          className="landing-page__video"
          src="https://lmnoftavsxqvkpcleehi.supabase.co/storage/v1/object/public/platform_logos/Google%20Chrome(1).gif"
          alt="Chrome animation"
        />
      </div>
      <div className="landing-page__actions">
        <button className="landing-page__cta landing-page__cta--ghost" onClick={onSignUp}>
          Sign up
        </button>
        <button className="landing-page__cta landing-page__cta--primary" onClick={onLogin}>
          Login
        </button>
      </div>
    </div>
  )
}
