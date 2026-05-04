/** Pillar ids from My Compass / signature v2 (`reach` = Connect, `enrol` = Enroll). */
export type AcademyCompassPillarId = "reach" | "enrol" | "deliver";

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
  /** When set, course card uses the same solid colour as that pillar on My Compass. */
  compassPillarId?: AcademyCompassPillarId;
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
