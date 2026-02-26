export function getChildAge(child: { age: number; birthDate?: Date | string }): number {
  if (child.birthDate) {
    const bd = typeof child.birthDate === 'string' ? new Date(child.birthDate) : child.birthDate;
    if (!isNaN(bd.getTime())) {
      const diff = Date.now() - bd.getTime();
      return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    }
  }
  return child.age;
}
