const submit = document.getElementById('register')
const back = document.getElementById('back')
const username = document.getElementById('username')

back.addEventListener('click', e => {
    location.href = '/'
})


//用了一点jquery 使头像选择项显示文件名
$("input[type=file]").change(function () {
    const fieldVal = $(this).val();
    if (fieldVal != undefined || fieldVal != "") {
        $(this).next(".custom-file-label").text(fieldVal);
    }
});