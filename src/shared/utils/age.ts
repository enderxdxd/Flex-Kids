export function getChildAge(child: { age: number; birthDate?: any }): number {
  if (child.birthDate) {
    let bd: Date;
    if (typeof child.birthDate === 'string') {
      bd = new Date(child.birthDate);
    } else if (typeof child.birthDate.toDate === 'function') {
      bd = child.birthDate.toDate();
    } else if (child.birthDate instanceof Date) {
      bd = child.birthDate;
    } else {
      return child.age;
    }
    if (!isNaN(bd.getTime())) {
      const diff = Date.now() - bd.getTime();
      return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    }
  }
  return child.age;
}
