/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { banDangChay, doiChieuVoiMayChu, KetQuaDoiChieu, KHONG_RO } from "../services/phienBan";
import { TimeService } from "../services/time";

/*
  DẤU HIỆU PHIÊN BẢN Ở CHÂN TRANG.

  VÌ SAO Ở ĐÂY chứ không nằm trong Cài đặt: ba câu hỏi nó trả lời đều là câu hỏi người dùng hỏi
  NGAY SAU khi vừa đẩy mã lên, và lúc ấy điều họ cần là liếc một cái chứ không phải mở hộp thoại.
  Chân trang vốn đã có một dòng chữ nhỏ, nên thêm vào đây không tốn thêm chỗ nào trên màn.

  Ba trạng thái, ba câu chữ khác hẳn nhau. Đặc biệt "không hỏi được" TUYỆT ĐỐI không được viết
  thành "đã mới nhất": mất mạng mà báo là mới nhất thì đúng vào kiểu khẳng định chưa đo mà bất biến
  4.9 cấm.
*/

/** Rút gọn thời điểm ISO thành "30/08 14:56". Rỗng thì trả chuỗi rỗng chứ không bịa. */
function gonThoiDiem(iso: string): string {
  if (!iso) return "";
  const d = TimeService.parseToDate(iso);
  if (!d || Number.isNaN(d.getTime())) return "";
  const hai = (n: number) => String(n).padStart(2, "0");
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)} ${hai(d.getHours())}:${hai(d.getMinutes())}`;
}

export default function DauHieuPhienBan() {
  const [ketQua, setKetQua] = useState<KetQuaDoiChieu | null>(null);

  useEffect(() => {
    let conGan = true;
    doiChieuVoiMayChu().then(kq => { if (conGan) setKetQua(kq); });
    return () => { conGan = false; };
  }, []);

  // Chạy trong môi trường không có khâu dựng nào bơm phiên bản vào thì im lặng, đừng hiện một dòng
  // "khong-ro" chẳng nói lên điều gì.
  if (banDangChay.sha === KHONG_RO) return null;

  const ngay = gonThoiDiem(banDangChay.ngayCommit) || gonThoiDiem(banDangChay.thoiDiemDung);
  const trangThai = ketQua?.trangThai ?? "dang-hoi";

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
      <span className="tabular-nums" title={`Mã commit ${banDangChay.sha}`}>
        bản {banDangChay.sha}
        {ngay && ` · ${ngay}`}
        {!banDangChay.dungTrenVercel && " · dựng ở máy nhà"}
      </span>

      {trangThai === "co-ban-moi-hon" && (
        <>
          <span className="text-brand-warning">
            · máy chủ đã có bản {ketQua?.banMayChu?.sha}
          </span>
          <button
            onClick={() => window.location.reload()}
            className="underline underline-offset-2 hover:text-text-primary cursor-pointer"
          >
            tải lại
          </button>
        </>
      )}

      {/*
        Nói rõ là CHƯA HỎI ĐƯỢC, không nói là đã mới nhất. Hai thứ khác hẳn nhau: một bên là "đã
        đối chiếu và khớp", một bên là "chưa đối chiếu được lần nào".
      */}
      {trangThai === "khong-hoi-duoc" && (
        <span title={ketQua?.lyDoKhongHoi}>· chưa đối chiếu được với máy chủ</span>
      )}
    </span>
  );
}
