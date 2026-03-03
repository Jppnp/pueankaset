#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== เพื่อนเกษตร POS — Release Script ===${NC}\n"

# 1. Check prerequisites
if ! command -v gh &> /dev/null; then
  echo -e "${RED}ต้องติดตั้ง GitHub CLI ก่อน: brew install gh${NC}"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${RED}มีไฟล์ที่ยังไม่ commit — กรุณา commit ก่อน${NC}"
  git status --short
  exit 1
fi

# 2. Pick version bump type
CURRENT=$(node -p "require('./package.json').version")
echo -e "เวอร์ชันปัจจุบัน: ${YELLOW}${CURRENT}${NC}\n"
echo "เลือกประเภทการอัปเดต:"
echo "  1) patch  (แก้บัค)       — $(node -p "require('semver/functions/inc')('${CURRENT}','patch')" 2>/dev/null || echo "x.x.+1")"
echo "  2) minor  (ฟีเจอร์ใหม่)  — $(node -p "require('semver/functions/inc')('${CURRENT}','minor')" 2>/dev/null || echo "x.+1.0")"
echo "  3) major  (เปลี่ยนใหญ่)   — $(node -p "require('semver/functions/inc')('${CURRENT}','major')" 2>/dev/null || echo "+1.0.0")"
echo ""
read -rp "เลือก (1/2/3): " CHOICE

case $CHOICE in
  1) BUMP="patch" ;;
  2) BUMP="minor" ;;
  3) BUMP="major" ;;
  *) echo -e "${RED}ตัวเลือกไม่ถูกต้อง${NC}"; exit 1 ;;
esac

# 3. Bump version (creates git tag automatically)
NEW_VERSION=$(npm version $BUMP --no-git-tag-version)
echo -e "\n${GREEN}เวอร์ชันใหม่: ${NEW_VERSION}${NC}"

# Commit and tag
git add package.json package-lock.json
git commit -m "release: ${NEW_VERSION}"
git tag "${NEW_VERSION}"

# 4. Build
echo -e "\n${YELLOW}กำลังบิลด์...${NC}"
npm run package

# 5. Push to GitHub
echo -e "\n${YELLOW}กำลัง push ขึ้น GitHub...${NC}"
git push && git push --tags

# 6. Collect release files
echo -e "\n${YELLOW}กำลังสร้าง GitHub Release...${NC}"
FILES=()
for f in dist/*.exe dist/*.dmg dist/*.yml dist/*.zip dist/*.AppImage; do
  [ -f "$f" ] && FILES+=("$f")
done

if [ ${#FILES[@]} -eq 0 ]; then
  echo -e "${RED}ไม่พบไฟล์ใน dist/ — ตรวจสอบ build output${NC}"
  exit 1
fi

echo "ไฟล์ที่จะอัปโหลด:"
printf '  %s\n' "${FILES[@]}"

# 7. Create GitHub Release
read -rp $'\nใส่บันทึกการเปลี่ยนแปลง (กด Enter เพื่อข้าม): ' NOTES
NOTES=${NOTES:-"Release ${NEW_VERSION}"}

gh release create "${NEW_VERSION}" "${FILES[@]}" \
  --title "${NEW_VERSION}" \
  --notes "${NOTES}"

echo -e "\n${GREEN}ปล่อย ${NEW_VERSION} สำเร็จ!${NC}"
echo -e "ดูได้ที่: $(gh release view "${NEW_VERSION}" --json url -q '.url')"
