import { Link } from 'react-router-dom'
import { Toggle, getButtonClassName } from '../../shared/ui'
import styles from './Footer.module.scss'

type FooterProps = {
  isAdmin: boolean
  theme: 'light' | 'dark'
  onLogout: () => void
  onThemeChange: (checked: boolean) => void
}

export const Footer = ({ isAdmin, theme, onLogout, onThemeChange }: FooterProps) => {
  return (
    <footer className={styles.footer}>
      {isAdmin ? (
        <button
          className={getButtonClassName({ uppercase: true })}
          type="button"
          onClick={onLogout}
        >
          Logout
        </button>
      ) : (
        <Link className={getButtonClassName({ uppercase: true })} to="/admin">
          Login
        </Link>
      )}
      <Toggle
        className={styles.themeToggle}
        checked={theme === 'dark'}
        labelLeft="Light"
        labelRight="Dark"
        onChange={onThemeChange}
      />
    </footer>
  )
}
