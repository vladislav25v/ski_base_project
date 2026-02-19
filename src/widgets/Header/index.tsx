import { Button, Toggle } from '../../shared/ui'
import styles from './Header.module.scss'

type HeaderProps = {
  menuOpen: boolean
  onMenuToggle: () => void
  theme: 'light' | 'dark'
  onThemeChange: (checked: boolean) => void
}

export const Header = ({ menuOpen, onMenuToggle, theme, onThemeChange }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <p className={styles.subtitle}>Тында</p>
        <h2 className={styles.brand}>ЛЫЖНАЯ БАЗА ДЮСШ №1</h2>
      </div>
      <div className={styles.actions}>
        <Toggle checked={theme === 'dark'} onChange={onThemeChange} />
        <Button
          className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ''}`}
          size="square"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={onMenuToggle}
        >
          <span>меню</span>
        </Button>
      </div>
    </header>
  )
}
