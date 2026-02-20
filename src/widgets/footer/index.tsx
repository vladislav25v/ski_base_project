import { Link } from 'react-router-dom'
import { Toggle, getButtonClassName } from '../../shared/ui'
import styles from './Footer.module.scss'

type FooterProps = {
  isAdmin: boolean
  onLogout: () => void
  theme: 'light' | 'dark'
  onThemeChange: (checked: boolean) => void
}

export const Footer = ({ isAdmin, onLogout, theme, onThemeChange }: FooterProps) => (
  <footer className={styles.footer}>
    <div className={styles.left}>
      {isAdmin ? (
        <button
          className={getButtonClassName({ uppercase: true })}
          type="button"
          onClick={onLogout}
        >
          Выйти
        </button>
      ) : (
        <Link className={getButtonClassName({ uppercase: true })} to="/admin">
          Кнопка директора
        </Link>
      )}
    </div>
    <Toggle className={styles.toggle} checked={theme === 'dark'} onChange={onThemeChange} />
  </footer>
)
