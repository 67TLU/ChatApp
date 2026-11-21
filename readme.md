
Đây là bản thiết kế của một hệ thống chat application realtime
1. **Hệ thống tài khoản và quan hệ:** đăng ký, đăng nhập, hồ sơ, kết bạn, chặn người dùng, nhóm và phân quyền.
2. **Hệ thống giao tiếp:** chat cá nhân, chat nhóm, gửi tệp, trạng thái online, thông báo và đồng bộ tin nhắn.
3. **Hệ thống cuộc gọi:** gọi thoại, video call, chia sẻ màn hình, quản lý phòng gọi và nhiều người tham gia.

Điểm quan trọng nhất trong thiết kế là phải tách biệt **luồng dữ liệu ứng dụng** (tin nhắn, trạng thái, thông báo) với **luồng truyền tải âm thanh/video**. Không nên gửi toàn bộ dữ liệu cuộc gọi qua WebSocket.

Mình sẽ lập kế hoạch theo hướng có thể triển khai thực tế với quy mô vừa, ưu tiên kiến trúc dễ phát triển và mở rộng, chưa cần chia thành hàng chục microservice.

# **1. Kiến trúc tổng thể**

**Frontend — Web Application**

React · REST API · WebSocket · WebRTC

**Backend API**

Node.js · Express · Authentication · Business Logic

**Realtime Server**

Socket.IO / WebSocket · Presence · Chat Events · Signaling

**PostgreSQL / MySQL**

Users · Messages · Groups · Friendships · Call Records

**Redis**(Nếu có)

Presence · Cache · Pub/Sub · Rate Limit · Socket Adapter

**Object Storage**

Ảnh · Video · File đính kèm
Lưa local cũng được
**Media Server**

WebRTC · SFU · STUN/TURN · Screen Sharing

Có thể bắt đầu bằng một **Modular Monolith**: một backend Node.js được chia thành các module rõ ràng, cộng với Redis, database và hệ thống media. Chỉ tách service độc lập khi có lý do về tải hoặc vận hành.

| Công nghệ             | Nhiệm vụ                                     |
| --------------------- | -------------------------------------------- |
| React                 | Giao diện ứng dụng                           |
| Node.js + Express     | REST API và xử lý nghiệp vụ                  |
| Socket.IO hoặc `ws`   | Realtime events                              |
| WebRTC                | Truyền âm thanh, video, màn hình             |
| PostgreSQL            | Lưu dữ liệu chính                            |
| Redis(Nếu có)         | Presence, cache, Pub/Sub, phân phối realtime |
| KHo lưa trữ local     | Lưu file, ảnh, video                         |
| STUN/TURN             | Hỗ trợ thiết lập kết nối media               |
# **2. Phạm vi chức năng cần xây dựng**

Mình đề xuất chia website thành 9 module nghiệp vụ chính.

## **2.1. Authentication — Quản lý tài khoản**

Bắt buộc

| Chức năng          | Mô tả                                     |
| ------------------ | ----------------------------------------- |
| Register           | Đăng ký tài khoản                         |
| Login / Logout     | Đăng nhập, đăng xuất                      |
| Email Verification | Xác minh email                            |
| Forgot Password    | Quên mật khẩu                             |
| Reset Password     | Đặt lại mật khẩu                          |
| Refresh Token      | Gia hạn phiên đăng nhập                   |
| Session Management | Quản lý phiên đăng nhập                   |
| Multi-device       | Đăng nhập nhiều thiết bị                  |
| Revoke Session     | Đăng xuất một hoặc tất cả thiết bị        |
| OAuth2             | Đăng nhập Google/GitHub                   |
| 2FA                | Xác thực hai lớp                          |
| Account Lock       | Khóa tài khoản khi có dấu hiệu bất thường |

Nên chia thành hai đối tượng:

- **Account:** thông tin xác thực, email, mật khẩu, trạng thái tài khoản.
- **Profile:** tên hiển thị, avatar, ảnh bìa, giới thiệu, trạng thái cá nhân.

Không nên dùng một trường `isOnline` trong bảng User làm nguồn dữ liệu đáng tin cậy duy nhất. Trạng thái online cần được quản lý theo các kết nối đang hoạt động.

## **2.2. User Management — Quản lý người dùng**

Bắt buộc

- Xem hồ sơ cá nhân.
- Chỉnh sửa thông tin.
- Thay đổi avatar, ảnh bìa.
- Tùy chỉnh trạng thái: Online, Away, Busy, Do Not Disturb, Offline.
- Tìm kiếm người dùng theo tên, username, email (theo chính sách riêng tư).
- Xem bạn bè chung.
- Xem danh sách thiết bị đang đăng nhập.
- Cấu hình quyền riêng tư.
- Xóa hoặc vô hiệu hóa tài khoản.
- Báo cáo người dùng.

## **2.3. Friendship — Hệ thống kết bạn**

Bắt buộc

Các chức năng:

- Gửi lời mời kết bạn.
- Chấp nhận / từ chối lời mời.
- Hủy lời mời đã gửi.
- Thu hồi lời mời.
- Hủy kết bạn.
- Danh sách bạn bè.
- Danh sách lời mời đang chờ.
- Danh sách lời mời đã gửi.
- Tìm kiếm bạn bè.
- Chặn / bỏ chặn người dùng.
- Bạn bè chung.

**Trạng thái quan hệ nên thiết kế:**

**NONE — Chưa có quan hệ**

**PENDING — Đang chờ xác nhận**

**ACCEPTED**

Đã là bạn bè

**REJECTED**

Đã từ chối

**BLOCKED — Bị chặn**

Thực tế nên lưu Block trong một quan hệ riêng, không gộp thành trạng thái của lời mời kết bạn.

Lưu ý: hai người đã kết bạn không có nghĩa là họ được phép xem mọi thông tin hoặc tham gia mọi nhóm của nhau.

## **2.4. Chat System — Hệ thống nhắn tin**

Bắt buộc

[Collapse sidebars / panes / spaces – Discord](https://images.openai.com/static-rsc-4/0r9p0oO1Rg4d8ENLx8TAh3VFZK4g4tdLCx1cpuBZlO4yFizZkEvnTAt6y-tFnDj9LB7gqdrMaY-Bhz8jkmOfsDjn9XyaCUX18AHqbFpYHVJLsLQYFbQ_idruZCnXYFyOu1BDFLrfNpIaCerVSvEbGB6_yMNtV8I7kkbpoX2edsQ?purpose=inline)

[Discord Review 2026: An Honest Analysis by a Competitor](https://images.openai.com/static-rsc-4/5PN6VfJrygdRWYOcd9ef5VquM9AD8ZbzhxdAK_b2_JDVZ63256HmsVzhGohei_9UrRRHgOfinCzfrVCuLL8eOk0F0RjP9Uhm3PqtSdqQGkMP7GDIVvrSqtBF-kPAPMp3QIl5o-1OTK9jxQz8gVf42TvTCccLZNCtjuhe7wZBtlU?purpose=inline)

[Discord Interface Analysis. Lorenzo Ramos | by Lorenzo Ramos | Medium](https://images.openai.com/static-rsc-4/IJfsMxheam9mZrRo5YNIG9C0kDtIkIrWuxA5SYZbunz1a6dhAqyTU_5go1EIKab_cClwLCiPZr146O2s6Yorbp3GePmvTl6pCgH6TidTCM1G5s7VRUhFCdeffROwhlXtlX8KM_rKX-pYUdewZVG_D5g_sQ-5-FAE1jj-jzoXsqU?purpose=inline)

[GroupMe | Group chat app](https://images.openai.com/static-rsc-4/Nej66OeyBTwFOf3Tc-Qq9KtwnDPu_UyU5xA5wDYXWqSg7N8KUricpMeyn54zv8wcnb6aIPZSd4ssgWqhyMsIinMrt4q5ZpbfljwWQeo78pDaLJ2mKEvukyyqm2Xd0M0zZuPM1XyOOEAuqQD-GF5o9UxtxSBPxpMQDlXFKXSyZHw?purpose=inline)

[Wire • Secure Messenger para PC y Mac - Descargar gratis \[Español\] 2026 | PcMac Store](https://images.openai.com/static-rsc-4/4PgTubxelbDRExzzI_uJL9Zujq9NHUMnOrfyBUD05nk-NxCiv-rJGEXJmCs-MZ-xC8aZfowb2WuCPnLAlLeRkieqmDr_3s9QVUdE5SKy-ku1giAithz4bHzhtDwAvHaIlY6G397FxnErwFteE1Qkaeji6SCPEoGz7qp_6GB27Z4?purpose=inline)

[A Threema Review - Is It The Most Secure option for 2025](https://images.openai.com/static-rsc-4/R7bGlPrt7QswJaBdTVIuxsUncQgE0Xb5MY9HlF3u0dxCcVU3Pmp5liuD3pNIHzWll3BK5PawV5P3bCSX9n8ezPYcaXm-XLp3dCh8GVCTa9XUQj0UEg3F6bKQY9NCD3bvo0vRQUWRlQaLG2v81nVncqngtzLN_wAHz964k2W1FZU?purpose=inline)

[Members Page – Discord](https://images.openai.com/static-rsc-4/jTGHFdLOp0GW_1yjkSvRblgsNRFXNdHGEqplU0GtPp-y8N01QATX1VMBz5XppY61-PL3QgLMPWmq_T0bUIl-HjeDNDgc7VKV8vQ_JRlw4WzLLG3p_DtW1bulfbGiqz9dayzZguCNR08GBpRHaj_vi0ZuawQYowUYUGis0npoDCk?purpose=inline)

[My Journey as an MLH Fellow | Lakshya Khatri](https://images.openai.com/static-rsc-4/JSOQwy0f4G-JgoSCl-NLK_iD4q9o-7Quc0DmVQ5Pmc9A3cglVl_7zkzl1rXz7SW5BE2Bf3zOuinylmlQflgPZMD5h-ngQabk382l8KU5lbOX9GU_RCGqG9vP8FJJEFOobofRTebWBzO9INv-1BM71PeKYCPC5sTkHiKW7muh8MQ?purpose=inline)

[Pinned Announcement feature – Discord](https://images.openai.com/static-rsc-4/KfKffJ3wvpyqJqqZ_ge6hkQRzpgalCxPVupB_5AeYBerrFCB6UB7qpQM-Lo_MprfZvweGHl2sGhiT2XT_hs-rgdO6bZDXB_WMCKetHP5My_UHXNdIYLsVmD17IOgiQ80nAXDFpNlgIBExfdyCXxkDMJnA_TcxFVTquwdyB9VzBg?purpose=inline)

[Discord for Businesses in the Age of COVID](https://images.openai.com/static-rsc-4/m-Ft7p9Xl_zv6xT31naRkVjl9ur7P-t2V5ZINS16QcbGv16NXsQ4di7bIx__9VtUBHPTyvyxsagbumzVoojRGxUMYq_pbRA6Ks-oUpvDDvcVAUZB9nAKR54amAaxys7VJshRAWmThdbmdnHUupW-H0Y_JECTV1s6Em69U3K6Wq8?purpose=inline)

[Flock 2.0: UI Walkthrough](https://images.openai.com/static-rsc-4/fY8FsjKpTavPURWHbge-CpBi7PUx061OVwvzRwSXiCNA6bGoFjoYgwd-bzUdvvOHPYrBrxDQ87CeBTGuUPq91euqy4-lWZMIVL1N5fIbcPRDuNjKciRnQqMhWwc9LRgYXTA_KIQ8Mnl5yhTQzFlgShMf4WyTXLgpsNzUCkYCdRI?purpose=inline)

**Chat cá nhân:**

- Nhắn tin 1-1.
- Thu hồi tin nhắn.
- Chỉnh sửa tin nhắn.
- Xóa tin nhắn.
- Reply / Quote.
- Forward.
- Reaction emoji.
- Gửi ảnh, video, file.
- Hiển thị trạng thái gửi / nhận / đã đọc.
- Typing indicator.
- Pin tin nhắn.
- Tìm kiếm nội dung chat.

**Chat nhóm:**

- Tạo cuộc trò chuyện nhóm.
- Thêm / xóa thành viên.
- Đổi tên, avatar nhóm.
- Rời nhóm.
- Chuyển quyền trưởng nhóm.
- Phân quyền thành viên.
- Pin tin nhắn.
- Mention thành viên.
- Quản lý tin nhắn.
- Lịch sử hoạt động nhóm.

**Các trạng thái tin nhắn:**

| Trạng thái | Ý nghĩa                           |
| ---------- | --------------------------------- |
| Sending    | Đang gửi                          |
| Sent       | Server đã tiếp nhận và lưu        |
| Delivered  | Đã chuyển đến thiết bị người nhận |
| Read       | Người nhận đã đọc                 |
| Failed     | Gửi thất bại                      |
| Deleted    | Đã xóa theo chính sách            |

Không nên nhầm `Sent`, `Delivered` và `Read`. Ví dụ, server lưu tin nhắn thành công nhưng người nhận đang offline thì tin nhắn vẫn `Sent`, không phải `Delivered`.

## **2.5. Group Management — Quản lý nhóm**

Bắt buộc

Mình khuyên thiết kế nhóm như một thực thể độc lập về nghiệp vụ, nhưng có thể dùng chung hệ thống Conversation với chat nhóm.

Các chức năng:

- Tạo nhóm.
- Sửa thông tin nhóm.
- Xóa nhóm.
- Thêm thành viên.
- Mời bằng liên kết.
- Thu hồi lời mời.
- Yêu cầu tham gia nhóm.
- Chấp nhận / từ chối yêu cầu.
- Rời nhóm.
- Kick thành viên.
- Ban / unban thành viên.
- Chuyển quyền sở hữu.
- Quản lý vai trò.
- Cấu hình quyền riêng tư.
- Đặt giới hạn thành viên.
- Quản lý lịch sử hoạt động.

Có thể mở rộng sau thành các kênh trong nhóm, ví dụ nhóm có kênh `General`, `Announcements`, `Voice Room`.

## **2.6. Voice & Video Call — Hệ thống cuộc gọi**

Chức năng cốt lõi
**Gọi cá nhân:**

- Gọi thoại.
- Video call.
- Nhận / từ chối cuộc gọi.
- Kết thúc cuộc gọi.
- Bật / tắt microphone.
- Bật / tắt camera.
- Chuyển camera.
- Chọn thiết bị âm thanh.
- Chia sẻ màn hình.
- Chia sẻ một cửa sổ hoặc tab trình duyệt.
- Chuyển đổi giữa camera và screen share.
- Xem trạng thái cuộc gọi.

**Gọi nhóm:**

- Tạo phòng gọi.
- Mời thành viên.
- Tham gia / rời phòng.
- Nhiều người bật camera.
- Nhiều người chia sẻ màn hình (có giới hạn theo chính sách).
- Mute thành viên.
- Remove thành viên.
- Quản lý quyền phát audio/video.
- Quản lý người điều hành phòng.
- Hiển thị người đang nói.
- Tự động kết nối lại khi mất mạng.

**Quản lý cuộc gọi:**

Nên có vòng đời cuộc gọi rõ ràng:

`CREATED → RINGING → ACCEPTED → CONNECTED → ENDED`

Ngoài ra cần có `REJECTED`, `MISSED`, `CANCELLED`, `FAILED` và `RECONNECTING`.

Một cuộc gọi có thể chứa nhiều người tham gia, vì vậy không nên chỉ lưu `caller_id` và `receiver_id`.

## **2.7. Presence — Trạng thái realtime**

Bắt buộc

- Online / Offline.
- Away / Busy / Do Not Disturb.
- Last seen.
- Đang nhập tin nhắn.
- Đang gọi điện.
- Đang chia sẻ màn hình.
- Đang hoạt động trong phòng nào.
- Số lượng thiết bị đang kết nối.
- Đồng bộ trạng thái giữa nhiều thiết bị.

Ví dụ: Một người đăng nhập trên laptop và điện thoại. Khi laptop ngắt mạng, người đó vẫn phải được hiển thị Online nếu điện thoại còn kết nối.

Do đó, Presence cần quản lý theo nhiều kết nối của một User, thay vì một cờ online/offline đơn giản.

## **2.8. Notification — Thông báo**

Bắt buộc

- Thông báo tin nhắn mới.
- Thông báo được nhắc tên.
- Lời mời kết bạn.
- Lời mời vào nhóm.
- Cuộc gọi đến.
- Thành viên tham gia / rời nhóm.
- Thông báo hệ thống.
- Thông báo trình duyệt.
- Cấu hình bật / tắt từng loại thông báo.
- Đánh dấu đã đọc.
- Xóa thông báo.

Nên phân biệt thông báo lưu trong Database và thông báo đẩy realtime. Khi người dùng offline, họ vẫn phải xem được thông báo khi quay lại.

## **2.9. Admin & Moderation — Quản trị và kiểm duyệt**

Bắt buộc

- Quản lý người dùng.
- Khóa / mở khóa tài khoản.
- Quản lý nhóm.
- Xem báo cáo vi phạm.
- Xử lý nội dung bị báo cáo.
- Quản lý file vi phạm.
- Theo dõi số lượng người dùng online.
- Theo dõi số lượng cuộc gọi.
- Quản lý vai trò admin.
- Audit log.
- Xem lịch sử hoạt động quản trị.

# **3. Authentication và Authorization — Xác thực và phân quyền**

Đây là phần rất quan trọng. Không nên chỉ tạo một bảng User có trường `role = admin/user` rồi dùng nó cho toàn bộ ứng dụng.

Bạn cần phân quyền ở nhiều cấp khác nhau.

## **3.1. Phân quyền toàn hệ thống**

Các vai trò đề xuất:

| Role        | Quyền                                        |
| ----------- | -------------------------------------------- |
| Guest       | Chưa đăng nhập, chỉ truy cập trang công khai |
| User        | Người dùng thông thường                      |
| Moderator   | Kiểm duyệt nội dung, xử lý báo cáo           |
| Support     | Hỗ trợ người dùng với quyền giới hạn         |
| Admin       | Quản lý hệ thống                             |
| Super Admin | Quản lý toàn bộ hệ thống và admin            |

Không nên trao quyền `Super Admin` cho tài khoản thông thường.

## **3.2. Phân quyền trong nhóm**

Mỗi nhóm có hệ thống vai trò riêng:

| Quyền                   | Owner | Admin           | Moderator | Member       |
| ----------------------- | ----- | --------------- | --------- | ------------ |
| Sửa thông tin nhóm      | ✓     | ✓               | -         | -            |
| Xóa nhóm                | ✓     | Có thể cấu hình | -         | -            |
| Thêm thành viên         | ✓     | ✓               | ✓         | Tùy cấu hình |
| Xóa thành viên          | ✓     | ✓               | ✓         | -            |
| Ban thành viên          | ✓     | ✓               | ✓         | -            |
| Xóa tin nhắn người khác | ✓     | ✓               | ✓         | -            |
| Gửi tin nhắn            | ✓     | ✓               | ✓         | ✓            |
| Gọi điện                | ✓     | ✓               | ✓         | ✓            |
| Quản lý vai trò         | ✓     | Giới hạn        | -         | -            |
| Chuyển quyền Owner      | ✓     | -               | -         | -            |

Các quyền gọi điện, gửi file, tạo kênh, ghim tin nhắn có thể được cấu hình riêng.

## **3.3. Phân quyền theo tài nguyên**

Ngoài Role, bạn cần kiểm tra quyền đối với từng tài nguyên.

Ví dụ:

- User A không thể sửa tin nhắn của User B nếu không có quyền.
- Người không thuộc nhóm không thể đọc tin nhắn nhóm.
- Người đã rời nhóm không được tiếp tục gửi tin nhắn.
- Người bị block không thể thực hiện các hành động bị hạn chế với người chặn.
- Người không thuộc phòng gọi không thể lấy token tham gia phòng đó.
- Admin của nhóm A không có quyền quản lý nhóm B.

Đây là mô hình kết hợp **RBAC + Resource-based Authorization**.

Ví dụ kiểm tra quyền gửi tin nhắn:

```
async function canSendMessage(userId, conversationId) {
    const member = await ConversationMember.findOne({
        userId,
        conversationId
    });

    if (!member) return false;
    if (member.status !== "ACTIVE") return false;

    const conversation = await Conversation.findById(conversationId);

    if (conversation.status !== "ACTIVE") return false;

    return member.permissions.includes("SEND_MESSAGE");
}
```

Đây chỉ là ví dụ minh họa. Thực tế cần kiểm tra thêm trạng thái tài khoản, block, thời hạn mute/ban và chính sách của nhóm.

**Nguyên tắc:** Frontend chỉ ẩn hoặc hiện nút theo quyền để cải thiện trải nghiệm. Backend mới là nơi quyết định người dùng có thực sự được phép thực hiện hành động hay không.

## **3.4. Quy trình xác thực đề xuất**

**User Login**

Email + Password / OAuth

**Backend Authentication**

Kiểm tra thông tin, trạng thái tài khoản

**Access Token**

Gửi khi gọi API / kết nối realtime

**Refresh Token**

Gia hạn phiên đăng nhập

**Authorization**

Kiểm tra quyền User, Group, Conversation, Call

**Allow / Deny**

Cho phép hoặc từ chối hành động

Một số yêu cầu bảo mật quan trọng:

- Hash mật khẩu bằng Argon2id hoặc bcrypt với cấu hình phù hợp.
- Refresh Token cần có cơ chế rotation và thu hồi.
- Cookie phiên đăng nhập cần cấu hình `HttpOnly`, `Secure`, `SameSite` phù hợp.
- Xác thực cả kết nối WebSocket, không chỉ REST API.
- Xác thực và phân quyền lại từng hành động realtime.
- Không cho client tự khai báo `userId` để giả danh người khác.
- Giới hạn tần suất gửi tin nhắn, kết bạn, gọi điện.
- Kiểm tra file upload và loại nội dung được phép.
- Bảo vệ các API quản trị.
- Có Audit Log cho hành động quan trọng.

# **4. Thiết kế riêng hệ thống Realtime**

Đây là phần cần đặc biệt chú ý vì ứng dụng của bạn sẽ có rất nhiều người kết nối đồng thời.

## **4.1. Phân chia REST API, WebSocket và WebRTC**

Không phải tất cả chức năng realtime đều sử dụng WebRTC.

| Chức năng                           | Công nghệ            |
| ----------------------------------- | -------------------- |
| Đăng nhập, đăng ký                  | REST API             |
| Tìm kiếm người dùng                 | REST API             |
| Lấy lịch sử tin nhắn                | REST API             |
| Gửi tin nhắn realtime               | WebSocket            |
| Tin nhắn mới                        | WebSocket            |
| Typing indicator                    | WebSocket            |
| Online / Offline                    | WebSocket            |
| Lời mời kết bạn                     | REST API + WebSocket |
| Thông báo cuộc gọi đến              | WebSocket            |
| Trao đổi thông tin kết nối cuộc gọi | Signaling            |
| Truyền âm thanh                     | WebRTC               |
| Truyền video                        | WebRTC               |
| Chia sẻ màn hình                    | WebRTC               |
| Lịch sử cuộc gọi                    | REST API             |

Một điểm cần hiểu:

- WebSocket giúp client và server trao đổi sự kiện.
- WebRTC đảm nhận truyền tải media.
- Signaling giúp các bên trao đổi thông tin cần thiết để thiết lập kết nối WebRTC.

Không nên truyền trực tiếp luồng video qua WebSocket.

## **4.2. Kiến trúc hệ thống cuộc gọi**

Có hai hướng chính.

**A. Peer-to-Peer (P2P)**

[TCP vs. UDP vs. gRPC: Choosing the Right Protocol for Your Architecture](https://images.openai.com/static-rsc-4/NrrZdMXnWveWNnMALyk4sC4j-fhLGv1wvZl0v2QdnQiJPAXB_gUOFBnwLpflRM8AHgS2RNLVUOaL2O0fH9ONcTt8oVQf7BLi6PoOaOUXbEbFf7n_lsWFoVYnOAffeU04SNVBFEti228zCcEgbsAtRnx0ZmVz0MSqdyC4xaIQl7Q?purpose=inline)

[designgurus.substack.com](https://designgurus.substack.com/p/an-engineers-guide-to-basic-networking?utm_source=chatgpt.com)

Hai người kết nối trực tiếp với nhau sau khi trao đổi signaling.

Ưu điểm: kiến trúc đơn giản hơn, thích hợp làm quen với WebRTC và thử nghiệm gọi 1-1.

Nhược điểm: khi gọi nhóm, mỗi người phải gửi media đến nhiều người khác, làm tăng tải upload của client.

**B. SFU (Selective Forwarding Unit)**

Mỗi người gửi luồng media lên SFU. SFU chuyển tiếp các luồng phù hợp đến những người tham gia khác.

Ưu điểm: phù hợp với gọi nhóm, dễ mở rộng và quản lý luồng media.

Nhược điểm: cần máy chủ media, tài nguyên mạng và quy trình vận hành riêng.
**Khuyến nghị của mình:**

- Giai đoạn học và thử nghiệm: tự triển khai WebRTC 1-1 để hiểu signaling, SDP, ICE, STUN/TURN.
- Giai đoạn phát triển sản phẩm: sử dụng SFU như LiveKit.
- Không nên tự viết SFU từ đầu nếu mục tiêu chính là hoàn thiện ứng dụng chat và gọi video.

LiveKit cung cấp SFU mã nguồn mở, có thể tự triển khai hoặc sử dụng dịch vụ quản lý sẵn.&#x20;


## **4.3. Các thành phần cần có của Call System**

| Thành phần           | Nhiệm vụ                                    |
| -------------------- | ------------------------------------------- |
| Call Manager         | Quản lý vòng đời cuộc gọi                   |
| Signaling            | Trao đổi thông tin thiết lập kết nối        |
| Media Server / SFU   | Chuyển tiếp media                           |
| STUN                 | Hỗ trợ xác định địa chỉ kết nối             |
| TURN                 | Relay media khi không thể kết nối trực tiếp |
| Call Room            | Quản lý phòng gọi                           |
| Participant Manager  | Quản lý người tham gia                      |
| Device Manager       | Quản lý microphone, camera, speaker         |
| Screen Share Manager | Quản lý chia sẻ màn hình                    |
| Network Monitor      | Theo dõi chất lượng kết nối                 |
| Reconnection Manager | Xử lý mất kết nối và kết nối lại            |

### **Một quy trình gọi điện mẫu**

**A: Gọi B**

**Backend kiểm tra quyền gọi**

Block, trạng thái tài khoản, quyền tham gia

**Gửi Call Invitation qua WebSocket**

**B nhận cuộc gọi**

**Backend cấp quyền tham gia Media Room**

**WebRTC kết nối Media Server**

Publish Audio / Video / Screen Share · Subscribe các luồng media

Phải đặc biệt chú ý: Backend cần kiểm tra quyền trước khi cấp token truy cập phòng media. Không để client tự tạo phòng hoặc tự quyết định mình có quyền tham gia phòng nào.

# **5. Thiết kế Database**

Với ứng dụng này, mình nghiêng về PostgreSQL vì dữ liệu có nhiều quan hệ: User, Friendship, Group, Conversation, Message, Call...

Đây là danh sách bảng ban đầu nên chuẩn bị.

## **5.1. Nhóm tài khoản**

| Bảng            | Dữ liệu               |
| --------------- | --------------------- |
| `users`         | Tài khoản             |
| `user_profiles` | Hồ sơ cá nhân         |
| `user_sessions` | Phiên đăng nhập       |
| `user_devices`  | Thiết bị              |
| `user_settings` | Cài đặt cá nhân       |
| `user_roles`    | Vai trò toàn hệ thống |
| `roles`         | Danh sách vai trò     |

## **5.2. Nhóm quan hệ**

| Bảng            | Dữ liệu                         |
| --------------- | ------------------------------- |
| `friendships`   | Lời mời và quan hệ kết bạn      |
| `blocks`        | Danh sách chặn                  |
| `friend_groups` | Nhóm bạn bè tùy chỉnh (nếu cần) |

## **5.3. Nhóm chat**

| Bảng                   | Dữ liệu                       |
| ---------------------- | ----------------------------- |
| `conversations`        | Cuộc hội thoại cá nhân / nhóm |
| `conversation_members` | Thành viên hội thoại          |
| `messages`             | Tin nhắn                      |
| `message_attachments`  | File đính kèm                 |
| `message_receipts`     | Trạng thái nhận / đọc         |
| `message_reactions`    | Reaction                      |
| `message_pins`         | Tin nhắn được ghim            |

## **5.4. Nhóm Group**

| Bảng                | Dữ liệu            |
| ------------------- | ------------------ |
| `groups`            | Thông tin nhóm     |
| `group_members`     | Thành viên         |
| `group_roles`       | Vai trò trong nhóm |
| `group_permissions` | Quyền nhóm         |
| `group_invitations` | Lời mời            |
| `group_bans`        | Thành viên bị cấm  |

Có thể dùng `conversation_id` để liên kết nhóm với hệ thống chat chung.

## **5.5. Nhóm Call**

| Bảng                | Dữ liệu                          |
| ------------------- | -------------------------------- |
| `call_sessions`     | Thông tin cuộc gọi               |
| `call_participants` | Thành viên tham gia              |
| `call_events`       | Sự kiện trong cuộc gọi           |
| `call_recordings`   | Metadata bản ghi nếu có ghi hình |

Không nên lưu video/audio trực tiếp trong Database. Chỉ lưu metadata hoặc đường dẫn đến Object Storage khi có tính năng ghi hình.

## **5.6. Nhóm hệ thống**

| Bảng              | Dữ liệu           |
| ----------------- | ----------------- |
| `notifications`   | Thông báo         |
| `user_reports`    | Báo cáo vi phạm   |
| `audit_logs`      | Lịch sử hành động |
| `uploaded_files`  | File đã upload    |
| `system_settings` | Cấu hình hệ thống |

Nguyên tắc thiết kế

Đối với ứng dụng này, cần chú ý:

- Tin nhắn nên có ID và thứ tự ổn định.
- Có `client_message_id` để chống tạo tin nhắn trùng khi client gửi lại sau mất mạng.
- Dùng cursor pagination cho lịch sử chat thay vì tải toàn bộ tin nhắn.
- Tách metadata file khỏi nội dung tin nhắn.
- Không dùng Database làm nơi lưu trạng thái typing hoặc presence liên tục.
- Có index cho `conversation_id`, `created_at`, `sender_id` và các trường truy vấn thường xuyên.

# **6. Thiết kế Backend**

Mình khuyên chia backend thành các module như sau:

```
backend/
│
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── friendships/
│   │   ├── conversations/
│   │   ├── messages/
│   │   ├── groups/
│   │   ├── calls/
│   │   ├── notifications/
│   │   ├── uploads/
│   │   ├── moderation/
│   │   └── admin/
│   │
│   ├── realtime/
│   │   ├── socket/
│   │   ├── handlers/
│   │   ├── events/
│   │   ├── rooms/
│   │   ├── presence/
│   │   └── middleware/
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── redis/
│   │   ├── storage/
│   │   ├── media/
│   │   └── queue/
│   │
│   ├── common/
│   │   ├── middleware/
│   │   ├── errors/
│   │   ├── validators/
│   │   ├── permissions/
│   │   └── utils/
│   │
│   ├── config/
│   ├── app.js
│   └── server.js
│
└── package.json
```

### **Phân biệt ba hệ thống**

**1. REST API**

Xử lý nghiệp vụ và dữ liệu có tính lâu dài.

Ví dụ:

```
POST   /api/auth/login
GET    /api/users/:id
POST   /api/friends/request
GET    /api/conversations
GET    /api/messages/:conversationId
POST   /api/groups
POST   /api/calls
GET    /api/notifications
```

**2. Realtime Server**

Xử lý sự kiện và trao đổi dữ liệu tức thời.

Ví dụ:

```
message:send
message:new
message:edit
message:delete
message:read

friend:request
friend:accepted

user:online
user:offline

typing:start
typing:stop

call:incoming
call:accept
call:reject
call:end

screen-share:start
screen-share:stop
```

**3. Media Server**

Xử lý truyền audio/video, các track media, kết nối và quản lý người tham gia phòng.

Đây là một hệ thống riêng về mặt chức năng, không nên nhồi toàn bộ xử lý media vào Express.

# **7. Thiết kế Frontend**

Mình đề xuất giao diện kiểu Discord/Messenger Desktop
## **Các trang chính**

| Trang            | Chức năng               |
| ---------------- | ----------------------- |
| Login / Register | Xác thực                |
| Home             | Trang chính             |
| Friends          | Quản lý bạn bè          |
| Friend Requests  | Lời mời kết bạn         |
| Direct Messages  | Tin nhắn cá nhân        |
| Group Chats      | Danh sách nhóm          |
| Group Details    | Thông tin và quyền nhóm |
| Chat Room        | Giao diện nhắn tin      |
| Call Room        | Gọi thoại / video       |
| Profile          | Hồ sơ cá nhân           |
| Notifications    | Thông báo               |
| Settings         | Cài đặt                 |
| Admin Dashboard  | Quản trị hệ thống       |

## **Các thành phần frontend quan trọng**

```
src/
├── components/
│   ├── Chat/
│   ├── VideoCall/
│   ├── ScreenShare/
│   ├── AudioControls/
│   ├── UserAvatar/
│   ├── FriendList/
│   ├── GroupList/
│   └── Notification/
│
├── features/
│   ├── auth/
│   ├── friends/
│   ├── messages/
│   ├── groups/
│   ├── calls/
│   └── settings/
│
├── hooks/
│   ├── useSocket/
│   ├── usePresence/
│   ├── useChat/
│   ├── useWebRTC/
│   ├── useMediaDevices/
│   └── useScreenShare/
│
├── services/
│   ├── api/
│   ├── socket/
│   └── media/
│
├── stores/
├── pages/
└── routes/
```

Không nên để WebSocket và WebRTC logic phân tán trong hàng chục component. Nên gom chúng vào các hook/service riêng để dễ quản lý vòng đời kết nối.

# **8. Hệ thống mở rộng và tối ưu**

Đây là những thành phần cần chuẩn bị để sản phẩm có thể phát triển lên quy mô vừa.

| Thành phần              | Mục đích                                    |
| ----------------------- | ------------------------------------------- |
| Redis                   | Presence, cache, Pub/Sub                    |
| Socket.IO Redis Adapter | Đồng bộ sự kiện giữa nhiều Socket.IO server |
| BullMQ                  | Xử lý thông báo và công việc nền            |
| Object Storage          | Lưu ảnh, file, video                        |
| CDN                     | Phân phối file và tài nguyên                |
| Load Balancer           | Phân phối kết nối                           |
| SFU                     | Xử lý gọi nhóm                              |
| TURN                    | Hỗ trợ kết nối media khó                    |
| Monitoring              | Theo dõi hệ thống                           |
| Logging                 | Theo dõi lỗi và hoạt động                   |
| Backup                  | Sao lưu Database và dữ liệu                 |

Một điểm cần nhớ về Socket.IO: khi chạy nhiều máy chủ, Redis Adapter giúp chuyển tiếp các sự kiện giữa các server thông qua Redis Pub/Sub. Tuy nhiên, adapter không phải hệ thống lưu trữ tin nhắn; tin nhắn vẫn phải được lưu trong Database.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://socket.io\&sz=32)

socket.io+1



Khi sử dụng Socket.IO với HTTP long-polling và nhiều server, còn cần chú ý sticky sessions ở Load Balancer.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://socket.io\&sz=32)

socket.io+1
Mình không khuyên xây tất cả tính năng cùng lúc. Với dự án có nhiều thành phần như thế này, nên hoàn thiện từng lớp.

1. **Giai đoạn 1 — Foundation**

   Ưu tiên cao nhất
   - Khởi tạo Frontend / Backend.
   - Thiết kế Database.
   - Authentication.
   - User Profile.
   - Quản lý Session.
   - Authorization.
2. **Giai đoạn 2 — Social System**
   - Tìm kiếm người dùng.
   - Kết bạn.
   - Hủy kết bạn.
   - Chặn người dùng.
   - Danh sách bạn bè.
   - Presence cơ bản.
3. **Giai đoạn 3 — Realtime Chat**
   - WebSocket / Socket.IO.
   - Chat 1-1.
   - Lịch sử tin nhắn.
   - Gửi file.
   - Typing.
   - Read Receipt.
   - Reconnect.
4. **Giai đoạn 4 — Group System**
   - Tạo nhóm.
   - Quản lý thành viên.
   - Group Roles.
   - Group Permissions.
   - Group Chat.
   - Moderation.
5. **Giai đoạn 5 — WebRTC Fundamentals**
   - Media Devices.
   - Microphone / Camera.
   - SDP.
   - ICE.
   - STUN / TURN.
   - Signaling.
   - Gọi 1-1.
6. **Giai đoạn 6 — Video Call & Screen Sharing**
   - Voice Call.
   - Video Call.
   - Screen Sharing.
   - Call Invitation.
   - Call State.
   - Reconnection.
   - Device Selection.
7. **Giai đoạn 7 — SFU & Group Call**
   - Tích hợp LiveKit.
   - Room Management.
   - Participant Management.
   - Nhiều người gọi cùng lúc.
   - Quản lý Audio / Video Tracks.
   - Screen Sharing trong phòng.
8. **Giai đoạn 8 — Notification & Background Jobs**
   - Notification Center.
   - Web Push.
   - BullMQ.
   - Email Notification.
   - Xử lý công việc nền.
9. **Giai đoạn 9 — Security & Scalability**
   - Rate Limiting.
   - Anti-spam.
   - Audit Logging.
   - Redis Adapter.
   - Load Balancer.
   - Monitoring.
   - Backup.
   - Stress Test.