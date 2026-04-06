#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== เพื่อนเกษตร POS — Release Script ===${NC}\n"

# 1. Check prerequisites
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${RED}มีไฟล์ที่ยังไม่ commit — กรุณา commit ก่อน${NC}"
  git status --short
  exit 1
fi

# 2. Pick version bump type
CURRENT=$(node -p "require('./package.json').version")
echo -e "เวอร์ชันปัจจุบัน: ${YELLOW}${CURRENT}${NC}\n"
echo "เลือกประเภทการอัปเดต:"
echo "  1) patch  (แก้บัค)"
echo "  2) minor  (ฟีเจอร์ใหม่)"
echo "  3) major  (เปลี่ยนใหญ่)"
echo ""
read -rp "เลือก (1/2/3): " CHOICE

case $CHOICE in
  1) BUMP="patch" ;;
  2) BUMP="minor" ;;
  3) BUMP="major" ;;
  *) echo -e "${RED}ตัวเลือกไม่ถูกต้อง${NC}"; exit 1 ;;
esac

# 3. Bump version
NEW_VERSION=$(npm version $BUMP --no-git-tag-version)
echo -e "\n${GREEN}เวอร์ชันใหม่: ${NEW_VERSION}${NC}"

# Commit and tag
git add package.json package-lock.json
git commit -m "release: ${NEW_VERSION}"
git tag "${NEW_VERSION}"

# 4. Push to GitHub — CI will build and create the release
echo -e "\n${YELLOW}กำลัง push ขึ้น GitHub...${NC}"
git push && git push --tags

echo -e "\n${GREEN}Push ${NEW_VERSION} สำเร็จ!${NC}"
echo -e "GitHub Actions จะบิลด์และสร้าง Release อัตโนมัติ (ทั้ง Windows และ macOS)"
echo -e "ดูสถานะได้ที่: https://github.com/jppnp/pueankaset/actions"
