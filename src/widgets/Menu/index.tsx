import { Link } from 'react-router-dom'
import { Button } from '../../shared/ui'
import styles from './Menu.module.scss'

type MenuProps = {
  isOpen: boolean
  onClose: () => void
  intro?: boolean
}

export const Menu = ({ isOpen, onClose, intro = false }: MenuProps) => {
  return (
    <div
      className={`${styles.menu} ${isOpen ? styles.menuOpen : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`${styles.menuPanel} ${intro ? styles.menuPanelIntro : ''}`}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen || undefined}
        id="site-menu"
      >
        <nav className={styles.nav}>
          <Link className={styles.navLink} to="/" onClick={onClose}>
            Главная
          </Link>
          <Link className={styles.navLink} to="/news" onClick={onClose}>
            Новости
          </Link>
          <Link className={styles.navLink} to="/calendar" onClick={onClose}>
            Календарь
          </Link>
          <Link className={styles.navLink} to="/tracks-scheme" onClick={onClose}>
            Схема трасс
          </Link>
          <Link className={styles.navLink} to="/rental" onClick={onClose}>
            Прокат
          </Link>
          <Link className={styles.navLink} to="/gallery" onClick={onClose}>
            Галерея
          </Link>
          <Link className={styles.navLink} to="/protocols" onClick={onClose}>
            Протоколы
          </Link>
          <Link className={styles.navLink} to="/about" onClick={onClose}>
            О базе
          </Link>
        </nav>
        <Button className={styles.menuClose} uppercase onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </div>
  )
}
