/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { banDangChay, chanDoanAI, ChanDoanAI, doiChieuVoiMayChu, KetQuaDoiChieu, KHONG_RO } from "../services/phienBan";
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
  const [ai, setAi] = useState<ChanDoanAI | null>(null);

  useEffect(() => {
    let conGan = true;
    doiChieuVoiMayChu().then(kq => { if (conGan) setKetQua(kq); });
    chanDoanAI().then(kq => { if (conGan) setAi(kq); });
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

      {/*
        TRẠNG THÁI AI, chỉ hiện khi CÓ VẤN ĐỀ.

        Sẵn sàng thì im lặng: một dòng "AI sẵn sàng" đọc mỗi lần mở app là nhiễu, vì đó là trạng
        thái đáng lẽ luôn đúng. Hỏng thì phải nói ngay, nói hỏng ở đâu, và nói cách gỡ, vì trước
        đây ứng dụng hỏng trong im lặng: mỗi tính năng tự báo lỗi riêng còn nguyên nhân chung thì
        không chỗ nào nói.

        "Đang hỏi" và "không hỏi được" cũng im lặng: chưa biết thì đừng dọa.

        Câu ngắn ở chân trang, nguyên nhân và cách gỡ nằm trong chú giải khi rê chuột. Chân trang
        là chỗ liếc chứ không phải chỗ đọc, và một dòng dài ở đó sẽ bị bỏ qua chứ không được đọc kỹ
        hơn. Đây là ứng dụng chạy trên máy tính nên rê chuột là thao tác có thật.
      */}
      {ai && ai.trangThai !== "san-sang" && ai.trangThai !== "dang-hoi" && ai.trangThai !== "khong-hoi-duoc" && (
        <span className="text-brand-warning" title={`${ai.moTa} ${ai.cachGo}`.trim()}>
          · AI đang không dùng được
        </span>
      )}
    </span>
  );
}
