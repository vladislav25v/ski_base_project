import { Link } from 'react-router-dom'
import { Button } from '../../shared/ui'
import styles from './Menu.module.scss'

type MenuProps = {
  isOpen: boolean
  onClose: () => void
}

export const Menu = ({ isOpen, onClose }: MenuProps) => {
  return (
    <div
      className={`${styles.menu} ${isOpen ? styles.menuOpen : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className={styles.menuPanel} role="dialog" aria-modal="true" id="site-menu">
        <nav className={styles.nav}>
          <Link className={styles.navLink} to="/" onClick={onClose}>
            Home
          </Link>
          <Link className={styles.navLink} to="/news" onClick={onClose}>
            News
          </Link>
          <Link className={styles.navLink} to="/calendar" onClick={onClose}>
            Calendar
          </Link>
        </nav>
        <Button className={styles.menuClose} uppercase onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
