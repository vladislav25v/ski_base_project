export type GraduatePhoto = {
  src: string
  alt: string
  caption?: string
}

export type Graduate = {
  id: string
  fullName: string
  graduationYear?: number
  cardPhoto: {
    src: string
    alt: string
  }
  shortDescription: string
  fullDescription: string[]
  gallery: GraduatePhoto[]
}

