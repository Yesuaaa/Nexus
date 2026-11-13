import { Dropdown, type DropdownOption } from "@/components/ui/dropdown"
import type { AuthCopy } from "../content/auth-copy"
import { focusOutline } from "../styles/auth-styles"
import type { AuthLanguage } from "../model/types"

const languageOptions: DropdownOption<AuthLanguage>[] = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
]

function LanguagePicker({
  language,
  copy,
  onChange,
}: {
  language: AuthLanguage
  copy: AuthCopy
  onChange: (language: AuthLanguage) => void
}) {
  return (
    <Dropdown
      value={language}
      options={languageOptions}
      onChange={onChange}
      label={copy.language}
      className="w-fit"
      triggerClassName={`h-11 w-fit min-w-0 gap-1 border-0 bg-transparent px-2 text-[13px] text-[#26395e] shadow-none hover:bg-transparent ${focusOutline}`}
    />
  )
}

export function AuthHeader({
  copy,
  language,
  onLanguageChange,
}: {
  copy: AuthCopy
  language: AuthLanguage
  onLanguageChange: (language: AuthLanguage) => void
}) {
  return (
    <header className="flex h-[73px] items-center px-8 text-[13px] max-[850px]:px-6">
      <div className="mx-auto flex w-full max-w-[400px] justify-end">
        <LanguagePicker
          language={language}
          copy={copy}
          onChange={onLanguageChange}
        />
      </div>
    </header>
  )
}
