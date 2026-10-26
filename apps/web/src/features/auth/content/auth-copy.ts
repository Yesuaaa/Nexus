import type { AuthLanguage } from "../model/types"
const languageStorageKey = "exp-auth-language"

export function getStoredAuthLanguage(): AuthLanguage {
  try {
    return window.localStorage.getItem(languageStorageKey) === "fil"
      ? "fil"
      : "en"
  } catch {
    return "en"
  }
}

export function storeAuthLanguage(language: AuthLanguage) {
  try {
    window.localStorage.setItem(languageStorageKey, language)
  } catch {
    // The current page still uses the selected language when storage is blocked.
  }
}

const copy = {
  en: {
    language: "Language",
    accountNavigation: "Account",
    community: "EXP community",
    fullNamePlaceholder: "John Doe",
    createAccountLink: "Register",
    signInLink: "Sign In",
    noAccountYet: "Don't have an account?",
    haveAccountYet: "Already have an account?",
    createOne: "Create one",
    signInHere: "Sign in",
    loginTitle: "Welcome Back",
    registerTitle: "Create Account",
    loginSubtitle: "Sign in to your EXP account",
    registerSubtitle: "Create your EXP account",
    loginHeroLine1: "Empower Your",
    loginHeroLine2: "Digital Solutions",
    loginHeroLine3: "Journey",
    loginHeroDescription:
      "Access powerful tools and insights to drive your campaigns forward. Sign in to continue your EXP experience.",
    registerHeroLine1: "Join the",
    registerHeroLine2: "EXP Community",
    registerHeroLine3: "Today",
    registerHeroDescription:
      "Create your account to start managing bookings and services with EXP.",
    choosePhoto: "Choose photo",
    showPhoto: "Show photo",
    fullName: "Full name",
    contactNumber: "Contact number",
    emailAddress: "Email address",
    password: "Password",
    confirmPassword: "Confirm Password",
    forgotPassword: "Forgot password?",
    showPassword: "Show",
    hidePassword: "Hide",
    passwordHint: "Use at least 12 characters.",
    signingIn: "Signing In…",
    creatingAccount: "Creating Account…",
    signInButton: "Sign In",
    createAccountButton: "Create Account",
    or: "OR",
    continueWith: "Continue with",
    continueWithGoogle: "Continue with Google",
    continueWithFacebook: "Continue with Facebook",
    continueWithApple: "Continue with Apple",
    socialOptionsUnavailable:
      "Social sign-in options couldn't be loaded. Try again.",
    socialUnavailable: "Social sign-in is not available right now.",
    socialRetry: "Try again",
    socialStartFailed: "Couldn't start social sign-in. Please try again.",
    socialCompleting: "Finishing social sign-in…",
    socialCompleteTitle: "Complete your account",
    socialFullName: "Full name",
    socialEmailCode: "Email verification code",
    socialSendCode: "Send email code",
    socialCodeSent: "We sent a verification code to your email address.",
    socialContinue: "Continue",
    socialCancelled:
      "Sign-in was cancelled. You can try again whenever you're ready.",
    socialFailed: "Social sign-in didn't finish. Please try again.",
    socialExistingAccount:
      "This email is already linked to an account. Sign in with that account, then connect this provider in Settings.",
    socialMissingFlow:
      "This sign-in link has expired or is incomplete. Start again from the sign-in page.",
    socialEmailCodeSentError:
      "Couldn't send a verification code. Check the email address and try again.",
    socialCompleteError:
      "Couldn't finish setting up your account. Please try again.",
    about: "About",
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    cookies: "Cookie Policy",
    copyright: "Copyright Policy",
    nameRequired: "Enter your full name.",
    nameLength: "Name must be 2 to 100 characters.",
    contactRequired: "Enter your contact number.",
    contactInvalid: "Enter a valid number, such as +63 912 345 6789.",
    emailRequired: "Enter your email address.",
    emailInvalid: "Enter a valid email address, such as name@example.com.",
    passwordRequired: "Enter your password.",
    passwordShort: "Use at least 12 characters for your password.",
    passwordLong: "Password is too long. Use fewer characters.",
    confirmRequired: "Confirm your password.",
    passwordMismatch: "Passwords do not match. Enter the same password.",
    badCredentials: "Email or password is incorrect. Please try again.",
    emailRegistered: "This email is already registered. Sign in instead.",
    rateLimited:
      "Too many sign-in attempts. Please wait 15 minutes and try again.",
    serverError: "The server is having trouble. Please try again shortly.",
    networkError:
      "Can't reach the server. Check your connection and try again.",
    unknownError: "Something went wrong. Please try again.",
    signInFailed: "Sign-in failed",
    signInUnavailable: "Sign-in unavailable",
    accountUnavailable: "Account unavailable",
    accountCreated: "Account created",
    welcomeToExp: "Welcome to EXP.",
    welcomeBackToast: "Welcome back",
    signedInToast: "You're signed in to EXP.",
    openingAccount: "Opening your account",
  },
  fil: {
    language: "Wika",
    accountNavigation: "Account",
    community: "Komunidad ng EXP",
    fullNamePlaceholder: "Juan Dela Cruz",
    createAccountLink: "Magrehistro",
    signInLink: "Mag-sign In",
    noAccountYet: "Wala pang account?",
    haveAccountYet: "May account ka na?",
    createOne: "Gumawa ng account",
    signInHere: "Mag-sign in",
    loginTitle: "Maligayang Pagbabalik",
    registerTitle: "Gumawa ng Account",
    loginSubtitle: "Mag-sign in sa iyong EXP account",
    registerSubtitle: "Gumawa ng iyong EXP account",
    loginHeroLine1: "Paunlarin ang Iyong",
    loginHeroLine2: "Digital na Paglalakbay",
    loginHeroLine3: "Ngayon",
    loginHeroDescription:
      "Gamitin ang mga tool at insight para mapalago ang iyong mga campaign. Mag-sign in para magpatuloy sa EXP.",
    registerHeroLine1: "Sumali sa",
    registerHeroLine2: "EXP Community",
    registerHeroLine3: "Ngayon",
    registerHeroDescription:
      "Gumawa ng account para pamahalaan ang mga booking at serbisyo sa EXP.",
    choosePhoto: "Pumili ng larawan",
    showPhoto: "Ipakita ang larawan",
    fullName: "Buong pangalan",
    contactNumber: "Numero ng telepono",
    emailAddress: "Email address",
    password: "Password",
    confirmPassword: "Kumpirmahin ang password",
    forgotPassword: "Nakalimutan ang password?",
    showPassword: "Ipakita ang",
    hidePassword: "Itago ang",
    passwordHint: "Gumamit ng hindi bababa sa 12 character.",
    signingIn: "Nag-si-sign in…",
    creatingAccount: "Gumagawa ng account…",
    signInButton: "Mag-sign In",
    createAccountButton: "Gumawa ng Account",
    or: "O",
    continueWith: "Magpatuloy gamit ang",
    continueWithGoogle: "Magpatuloy gamit ang Google",
    continueWithFacebook: "Magpatuloy gamit ang Facebook",
    continueWithApple: "Magpatuloy gamit ang Apple",
    socialOptionsUnavailable: "Hindi ma-load ang social sign-in. Subukan muli.",
    socialUnavailable: "Hindi available ang social sign-in sa ngayon.",
    socialRetry: "Subukan muli",
    socialStartFailed: "Hindi masimulan ang social sign-in. Subukan muli.",
    socialCompleting: "Kinukumpleto ang social sign-in…",
    socialCompleteTitle: "Kumpletuhin ang iyong account",
    socialFullName: "Buong pangalan",
    socialEmailCode: "Email verification code",
    socialSendCode: "Magpadala ng email code",
    socialCodeSent:
      "Nagpadala kami ng verification code sa iyong email address.",
    socialContinue: "Magpatuloy",
    socialCancelled:
      "Kinansela ang pag-sign in. Maaari kang sumubok muli anumang oras.",
    socialFailed: "Hindi natapos ang social sign-in. Subukan muli.",
    socialExistingAccount:
      "Naka-link na ang email na ito sa isang account. Mag-sign in sa account na iyon, saka ikonekta ang provider na ito sa Settings.",
    socialMissingFlow:
      "Nag-expire o hindi kumpleto ang sign-in link. Magsimula muli sa sign-in page.",
    socialEmailCodeSentError:
      "Hindi makapagpadala ng verification code. Suriin ang email at subukan muli.",
    socialCompleteError:
      "Hindi makumpleto ang pag-set up ng account. Subukan muli.",
    about: "Tungkol sa Amin",
    terms: "Mga Tuntunin sa Paggamit",
    privacy: "Patakaran sa Privacy",
    cookies: "Patakaran sa Cookies",
    copyright: "Patakaran sa Copyright",
    nameRequired: "Ilagay ang iyong buong pangalan.",
    nameLength: "Dapat 2 hanggang 100 character ang pangalan.",
    contactRequired: "Ilagay ang numero ng iyong telepono.",
    contactInvalid: "Maglagay ng wastong numero, gaya ng +63 912 345 6789.",
    emailRequired: "Ilagay ang iyong email address.",
    emailInvalid:
      "Maglagay ng wastong email address, gaya ng name@example.com.",
    passwordRequired: "Ilagay ang iyong password.",
    passwordShort: "Gumamit ng hindi bababa sa 12 character para sa password.",
    passwordLong:
      "Masyadong mahaba ang password. Gumamit ng mas kaunting character.",
    confirmRequired: "Kumpirmahin ang iyong password.",
    passwordMismatch: "Hindi magkapareho ang mga password. Subukan muli.",
    badCredentials: "Mali ang email o password. Subukan muli.",
    emailRegistered: "Nairehistro na ang email na ito. Mag-sign in na lang.",
    rateLimited:
      "Napakaraming pagtatangkang mag-sign in. Maghintay ng 15 minuto at subukan muli.",
    serverError: "May problema ang server. Subukan muli maya-maya.",
    networkError:
      "Hindi maabot ang server. Suriin ang koneksyon at subukan muli.",
    unknownError: "May nangyaring mali. Subukan muli.",
    signInFailed: "Hindi nagtagumpay ang pag-sign in",
    signInUnavailable: "Hindi available ang pag-sign in",
    accountUnavailable: "Hindi available ang account",
    accountCreated: "Nagawa na ang account",
    welcomeToExp: "Maligayang pagdating sa EXP.",
    welcomeBackToast: "Maligayang pagbabalik",
    signedInToast: "Naka-sign in ka na sa EXP.",
    openingAccount: "Binubuksan ang iyong account",
  },
} as const

export type AuthCopy = typeof copy.en | typeof copy.fil

export function getAuthCopy(language: AuthLanguage): AuthCopy {
  return copy[language]
}
