document.addEventListener('DOMContentLoaded', function() {
    console.log('網頁已加載完成！');
    
    // 在這裡添加您的JavaScript代碼
    const header = document.querySelector('header h1');
    header.addEventListener('click', function() {
        alert('您點擊了標題！');
    });
});
