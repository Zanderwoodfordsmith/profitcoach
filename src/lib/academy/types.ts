export type AcademyLesson = {
  id: string;
  title: string;
  emoji?: string;
  description?: string;
  /** Supports common YouTube URLs; other URLs may show as a link or generic video element later. */
  videoUrl?: string | null;
  bodyMarkdown?: string;
};

export type AcademyCourse = {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  lessons: AcademyLesson[];
};

export type AcademyCategory = {
  id: string;
  title: string;
  description?: string;
  courses: AcademyCourse[];
};

export type AcademyCatalog = {
  categories: AcademyCategory[];
};
